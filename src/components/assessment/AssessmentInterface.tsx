import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, BookOpen, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Question {
  id: string;
  test_id: string;
  passage_id?: string | null;
  question_type: string;
  difficulty: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
  order_index: number;
  media_url?: string | null;
  media_type?: string | null;
  passage_text?: string | null;
  passage_title?: string | null;
}

const AssessmentInterface = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [testData, setTestData] = useState<any>(null);
  const [testId, setTestId] = useState<string>('');
  
  const [assignedLevel, setAssignedLevel] = useState<"easy" | "medium" | "hard" | null>(null);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // Auto-save state to database
  const saveSession = useCallback(async () => {
    if (!user || !testId) return;
    
    try {
      await supabase
        .from('test_sessions')
        .upsert({
          test_id: testId,
          student_id: user.id,
          answers,
          current_question: currentQuestionIndex,
          time_remaining: timeRemaining,
          marked_for_review: Array.from(markedForReview),
          difficulty_level: assignedLevel,
          practice_complete: practiceComplete,
          last_saved_at: new Date().toISOString(),
        }, {
          onConflict: 'test_id,student_id'
        });
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [user, testId, answers, currentQuestionIndex, timeRemaining, markedForReview, assignedLevel, practiceComplete]);

  // Save on visibility change and before unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveSession();
      }
    };

    const handleBeforeUnload = () => {
      saveSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Auto-save every 30 seconds
    const autoSaveInterval = setInterval(saveSession, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(autoSaveInterval);
    };
  }, [saveSession]);

  useEffect(() => {
    initializeTest();
  }, []);

  useEffect(() => {
    if (testData && testId) {
      loadQuestions();
    }
  }, [testData, testId]);

  useEffect(() => {
    if (testData?.duration_minutes && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [testData]);

  const initializeTest = async () => {
    try {
      const testDataStr = localStorage.getItem("currentTest");

      if (!testDataStr) {
        toast({ title: "Error", description: "Missing test data", variant: "destructive" });
        navigate("/student/dashboard");
        return;
      }

      const test = JSON.parse(testDataStr);
      setTestData(test);
      setTestId(test.id);
      setTimeRemaining(test.duration_minutes * 60);

      // Check for existing session
      if (user) {
        const { data: session } = await supabase
          .from('test_sessions')
          .select('*')
          .eq('test_id', test.id)
          .eq('student_id', user.id)
          .single();

        if (session) {
          setAnswers((session.answers as Record<number, string>) || {});
          setCurrentQuestionIndex(session.current_question || 0);
          setTimeRemaining(session.time_remaining || test.duration_minutes * 60);
          setMarkedForReview(new Set((session.marked_for_review as number[]) || []));
          setAssignedLevel(session.difficulty_level as any);
          setPracticeComplete(session.practice_complete || false);
          toast({ title: "Session Restored", description: "Continuing from where you left off" });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load test", variant: "destructive" });
      navigate("/student/dashboard");
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      // Fetch questions from Supabase
      const { data: allQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('test_id', testId)
        .order('order_index');

      if (error) throw error;

      if (!allQuestions || allQuestions.length === 0) {
        toast({ title: "Error", description: "No questions found for this test", variant: "destructive" });
        setLoading(false);
        return;
      }

      const mappedQuestions = allQuestions.map(q => ({
        ...q,
        options: q.options as string[] | null,
      })) as Question[];

      // Start with practice questions or skip to main test
      if (!practiceComplete) {
        const practiceQs = mappedQuestions.filter(q => q.difficulty === 'practice');
        if (practiceQs.length > 0) {
          setQuestions(shuffleArray(practiceQs));
          setLoading(false);
          return;
        }
        // No practice questions, start main test
        setPracticeComplete(true);
      }

      // Load main test questions based on assigned level or find first available
      const level = assignedLevel || 'easy';
      let mainQs = mappedQuestions.filter(q => q.difficulty === level);
      
      if (mainQs.length === 0) {
        // Try other levels
        mainQs = mappedQuestions.filter(q => q.difficulty === 'easy') ||
                 mappedQuestions.filter(q => q.difficulty === 'medium') ||
                 mappedQuestions.filter(q => q.difficulty === 'hard');
      }

      if (mainQs.length > 0) {
        setQuestions(shuffleArray(mainQs));
      } else {
        toast({ title: "Error", description: "No questions available", variant: "destructive" });
      }
      
      setLoading(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load questions", variant: "destructive" });
      setLoading(false);
    }
  };

  const calculatePracticeScore = () => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) {
        correct++;
      }
    });
    return Math.round((correct / questions.length) * 100);
  };

  const assignDifficultyLevel = async (score: number) => {
    let targetLevel: "easy" | "medium" | "hard";
    
    if (score >= 75) {
      targetLevel = "hard";
    } else if (score >= 50) {
      targetLevel = "medium";
    } else {
      targetLevel = "easy";
    }

    setAssignedLevel(targetLevel);
    setPracticeScore(score);
    setPracticeComplete(true);

    toast({
      title: "Practice Complete!",
      description: `You scored ${score}%. Starting ${targetLevel.toUpperCase()} level test.`,
      duration: 3000,
    });

    setAnswers({});
    setCurrentQuestionIndex(0);
    setSelectedAnswer("");
    setMarkedForReview(new Set());

    // Reload questions for the assigned level
    setLoading(true);
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', testId)
      .eq('difficulty', targetLevel)
      .order('order_index');

    if (allQuestions && allQuestions.length > 0) {
      const mapped = allQuestions.map(q => ({ ...q, options: q.options as string[] | null })) as Question[];
      setQuestions(shuffleArray(mapped));
    }
    setLoading(false);
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(answers[currentQuestionIndex + 1] || "");
    } else {
      if (!practiceComplete) {
        const score = calculatePracticeScore();
        assignDifficultyLevel(score);
      } else {
        handleSubmit();
      }
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setSelectedAnswer(answers[currentQuestionIndex - 1] || "");
    }
  };

  const handleSubmit = async () => {
    if (!practiceComplete) {
      const score = calculatePracticeScore();
      assignDifficultyLevel(score);
      return;
    }

    const timeSpent = (testData?.duration_minutes * 60 || 3600) - timeRemaining;
    
    let correctAnswers = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) {
        correctAnswers++;
      }
    });

    const finalScore = Math.round((correctAnswers / questions.length) * 100);

    // Save result to Supabase
    if (user) {
      const { error } = await supabase
        .from('test_results')
        .insert({
          test_id: testId,
          student_id: user.id,
          score: finalScore,
          correct_answers: correctAnswers,
          wrong_answers: questions.length - correctAnswers,
          total_questions: questions.length,
          difficulty_level: assignedLevel,
          practice_score: practiceScore,
          time_spent: timeSpent,
          answers,
        });

      if (error) {
        console.error('Error saving result:', error);
      }

      // Delete the session since test is complete
      await supabase
        .from('test_sessions')
        .delete()
        .eq('test_id', testId)
        .eq('student_id', user.id);
    }

    // Clear localStorage
    localStorage.removeItem('currentTest');

    toast({
      title: "Test Submitted!",
      description: `Your score: ${finalScore}%`,
      duration: 5000,
    });

    navigate("/student/dashboard");
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleMarkForReview = () => {
    const newMarked = new Set(markedForReview);
    if (newMarked.has(currentQuestionIndex)) {
      newMarked.delete(currentQuestionIndex);
    } else {
      newMarked.add(currentQuestionIndex);
    }
    setMarkedForReview(newMarked);
  };

  if (loading || !questions.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-lg text-muted-foreground">Loading assessment...</div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasPassage = currentQuestion.passage_text;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/10">
      {/* Top Navigation Bar */}
      <div className="cloud-bubble-top sticky top-0 z-50 px-6 py-4 mb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Timer */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Time Remaining</p>
              <p className={`text-xl font-bold font-mono ${timeRemaining < 300 ? 'text-destructive' : 'text-foreground'}`}>
                {formatTime(timeRemaining)}
              </p>
            </div>
          </div>

          {/* Question Navigation Bubbles */}
          <div className="flex gap-2 flex-wrap justify-center max-w-md">
            {questions.map((_, idx) => {
              const isAnswered = answers[idx] !== undefined;
              const isCurrent = idx === currentQuestionIndex;
              const isMarked = markedForReview.has(idx);

              return (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentQuestionIndex(idx);
                    setSelectedAnswer(answers[idx] || "");
                  }}
                  className={`question-nav-bubble ${
                    isCurrent ? 'active' : isAnswered ? 'answered' : 'unanswered'
                  } ${isMarked ? 'ring-2 ring-warning' : ''}`}
                  title={isMarked ? 'Marked for review' : ''}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Test Info */}
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {practiceComplete ? 'Main Test' : 'Practice'}
            </p>
            <p className="font-semibold text-foreground">
              {practiceComplete && assignedLevel && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {assignedLevel.toUpperCase()}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className={`grid ${hasPassage ? 'lg:grid-cols-[60%_40%]' : 'lg:grid-cols-1 max-w-3xl mx-auto'} gap-6`}>
          {/* Left Panel - Reading Passage (only show if passage exists) */}
          {hasPassage && (
            <div className="passage-bubble p-6">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">
                  {currentQuestion.passage_title || 'Reading Passage'}
                </h3>
              </div>
              <div className="passage-text">
                {currentQuestion.passage_text}
              </div>
            </div>
          )}

          {/* Right Panel - Question & Answers */}
          <div className="space-y-6">
            {/* Question Card */}
            <div className="question-bubble">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
                <h4 className="font-semibold text-lg text-foreground mb-2">
                  {currentQuestion.question_text}
                </h4>
                <p className="text-xs text-muted-foreground">
                  [{currentQuestion.marks} mark{currentQuestion.marks !== 1 ? 's' : ''}]
                </p>
              </div>

              {/* Media Display */}
              {currentQuestion.media_url && (
                <div className="mb-4">
                  {currentQuestion.media_type === 'image' && (
                    <img
                      src={currentQuestion.media_url}
                      alt="Question media"
                      className="max-w-full h-auto rounded-xl border border-border"
                    />
                  )}
                  {currentQuestion.media_type === 'audio' && (
                    <audio controls className="w-full">
                      <source src={currentQuestion.media_url} />
                    </audio>
                  )}
                  {currentQuestion.media_type === 'video' && (
                    <video controls className="w-full rounded-xl border border-border">
                      <source src={currentQuestion.media_url} />
                    </video>
                  )}
                </div>
              )}

              {/* Answer Options */}
              <div className="space-y-3">
                {currentQuestion.question_type === 'mcq' && currentQuestion.options && (
                  <>
                    {currentQuestion.options.map((option, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = selectedAnswer === letter;

                      return (
                        <div
                          key={idx}
                          onClick={() => handleAnswerSelect(letter)}
                          className={`answer-card ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                            }`}>
                              <span className="text-sm font-medium">{letter}</span>
                            </div>
                            <span className="text-foreground">{option}</span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={handlePrevQuestion}
                disabled={currentQuestionIndex === 0}
                className="rounded-xl"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <Button
                variant="outline"
                onClick={toggleMarkForReview}
                className={`rounded-xl ${markedForReview.has(currentQuestionIndex) ? 'bg-warning/20 border-warning' : ''}`}
              >
                <Flag className={`h-4 w-4 mr-1 ${markedForReview.has(currentQuestionIndex) ? 'text-warning' : ''}`} />
                {markedForReview.has(currentQuestionIndex) ? 'Marked' : 'Mark for Review'}
              </Button>

              <Button
                onClick={handleNextQuestion}
                className="nav-btn-next"
              >
                {isLastQuestion ? (practiceComplete ? 'Submit Test' : 'Complete Practice') : 'Next'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Submit Button (when at last question) */}
            {isLastQuestion && practiceComplete && (
              <Button
                onClick={handleSubmit}
                className="w-full bg-success text-success-foreground hover:bg-success/90 mt-4"
              >
                Submit Test
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentInterface;
