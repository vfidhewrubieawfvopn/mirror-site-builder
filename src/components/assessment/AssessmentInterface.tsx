import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { Clock, BookOpen, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuestions, Question } from "@/hooks/useQuestions";

const AssessmentInterface = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [studentData, setStudentData] = useState<any>(null);
  const [testData, setTestData] = useState<any>(null);
  const [testId, setTestId] = useState<string>('');
  
  // Adaptive difficulty states
  const [assignedLevel, setAssignedLevel] = useState<"easy" | "medium" | "hard" | null>(null);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const { fetchQuestions } = useQuestions(testId);

  useEffect(() => {
    initializeTest();
  }, []);

  useEffect(() => {
    if (testData && testId) {
      loadPracticeQuestions();
    }
  }, [testData, testId]);

  useEffect(() => {
    if (testData?.duration_minutes) {
      const durationSeconds = testData.duration_minutes * 60;
      setTimeRemaining(durationSeconds);

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

  const initializeTest = () => {
    try {
      const studentDataStr = localStorage.getItem("studentData");
      const testDataStr = localStorage.getItem("currentTest");

      if (!studentDataStr || !testDataStr) {
        toast({ title: "Error", description: "Missing test or student data", variant: "destructive" });
        navigate("/");
        return;
      }

      const student = JSON.parse(studentDataStr);
      const test = JSON.parse(testDataStr);

      setStudentData(student);
      setTestData(test);
      setTestId(test.id);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load test", variant: "destructive" });
      navigate("/");
    }
  };

  // Fisher-Yates shuffle algorithm for randomizing questions
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const loadPracticeQuestions = () => {
    setLoading(true);
    try {
      const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
      const practiceQs = allQuestions
        .filter((q: Question) => q.test_id === testId && q.difficulty === 'practice');
      
      if (practiceQs.length > 0) {
        // Randomize practice questions
        setQuestions(shuffleArray(practiceQs));
        setLoading(false);
      } else {
        // No practice questions, find the first available difficulty level
        toast({ title: "Notice", description: "No practice questions found. Starting main test." });
        setPracticeComplete(true);
        
        // Check which levels have questions and start with easiest available
        const easyQs = allQuestions.filter((q: Question) => q.test_id === testId && q.difficulty === 'easy');
        const mediumQs = allQuestions.filter((q: Question) => q.test_id === testId && q.difficulty === 'medium');
        const hardQs = allQuestions.filter((q: Question) => q.test_id === testId && q.difficulty === 'hard');
        
        if (easyQs.length > 0) {
          setAssignedLevel('easy');
          loadMainQuestions('easy');
        } else if (mediumQs.length > 0) {
          setAssignedLevel('medium');
          loadMainQuestions('medium');
        } else if (hardQs.length > 0) {
          setAssignedLevel('hard');
          loadMainQuestions('hard');
        } else {
          toast({ title: "Error", description: "No questions available for this test.", variant: "destructive" });
          setLoading(false);
        }
      }
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
    const score = (correct / questions.length) * 100;
    return Math.round(score);
  };

  const assignDifficultyLevel = async (score: number) => {
    // Determine target level based on score
    let targetLevel: "easy" | "medium" | "hard";
    
    if (score >= 75) {
      targetLevel = "hard";
    } else if (score >= 50) {
      targetLevel = "medium";
    } else {
      targetLevel = "easy";
    }

    // Check which levels actually have questions
    const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
    const easyQs = allQuestions.filter((q: Question) => q.test_id === testId && q.difficulty === 'easy');
    const mediumQs = allQuestions.filter((q: Question) => q.test_id === testId && q.difficulty === 'medium');
    const hardQs = allQuestions.filter((q: Question) => q.test_id === testId && q.difficulty === 'hard');
    
    // Find the best available level (target or closest available)
    let level: "easy" | "medium" | "hard" = targetLevel;
    
    if (targetLevel === 'hard' && hardQs.length === 0) {
      level = mediumQs.length > 0 ? 'medium' : (easyQs.length > 0 ? 'easy' : 'hard');
    } else if (targetLevel === 'medium' && mediumQs.length === 0) {
      level = easyQs.length > 0 ? 'easy' : (hardQs.length > 0 ? 'hard' : 'medium');
    } else if (targetLevel === 'easy' && easyQs.length === 0) {
      level = mediumQs.length > 0 ? 'medium' : (hardQs.length > 0 ? 'hard' : 'easy');
    }

    setAssignedLevel(level);
    setPracticeScore(score);
    setPracticeComplete(true);

    const levelNote = level !== targetLevel 
      ? ` (${targetLevel} not available)` 
      : '';

    toast({
      title: "Practice Complete!",
      description: `You scored ${score}%. Starting ${level.toUpperCase()} level test${levelNote}.`,
      duration: 3000,
    });

    // Reset for main test
    setAnswers({});
    setCurrentQuestionIndex(0);
    setSelectedAnswer("");
    setMarkedForReview(new Set());

    loadMainQuestions(level);
  };

  const loadMainQuestions = (level: string) => {
    setLoading(true);
    try {
      const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
      const mainQs = allQuestions
        .filter((q: Question) => q.test_id === testId && q.difficulty === level);
      // Randomize questions so different students get different order
      setQuestions(shuffleArray(mainQs));
      setLoading(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load questions", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
  };

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(answers[currentQuestionIndex + 1] || "");
    } else {
      // Last question
      if (!practiceComplete) {
        // Complete practice and assign difficulty
        const score = calculatePracticeScore();
        assignDifficultyLevel(score);
      } else {
        // Submit main test
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

  const handleSubmit = () => {
    if (!practiceComplete) {
      // This is practice submission
      const score = calculatePracticeScore();
      assignDifficultyLevel(score);
      return;
    }

    // Main test submission
    const endTime = new Date();
    const timeSpent = (testData?.duration_minutes * 60 || 3600) - timeRemaining;
    
    let correctAnswers = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) {
        correctAnswers++;
      }
    });

    const finalScore = Math.round((correctAnswers / questions.length) * 100);

    // Save to localStorage
    const result = {
      studentId: studentData?.studentId,
      testCode: testData?.testCode,
      testTitle: testData?.title || 'Assessment',
      subject: testData?.subject || 'General',
      score: finalScore,
      correctAnswers,
      wrongAnswers: questions.length - correctAnswers,
      totalQuestions: questions.length,
      difficultyLevel: assignedLevel,
      practiceScore,
      timeSpent,
      completedAt: endTime.toISOString(),
      answers,
      markedForReview: Array.from(markedForReview)
    };

    const results = JSON.parse(localStorage.getItem("testResults") || "[]");
    results.push(result);
    localStorage.setItem("testResults", JSON.stringify(results));

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

  // Group questions by passage_id for rendering
  const currentPassage = currentQuestion.passage_id 
    ? questions.find(q => q.passage_id === currentQuestion.passage_id && q.passage_text)
    : null;

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

      {/* Main Content - 60/40 Split */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid lg:grid-cols-[60%_40%] gap-6">
          {/* Left Panel - Reading Passage */}
          <div className="passage-bubble p-6">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">
                {currentPassage?.passage_title || currentQuestion.passage_title || 'Reading Passage'}
              </h3>
            </div>
            <div className="passage-text">
              {currentPassage?.passage_text || currentQuestion.passage_text || 'No passage available.'}
            </div>
          </div>

          {/* Right Panel - Question & Answers */}
          <div className="space-y-6">
            {/* Question Card */}
            <div className="question-bubble">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Question {currentQuestionIndex + 1} of {questions.length}
                  {currentQuestion.sub_question_label && ` (${currentQuestion.sub_question_label})`}
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

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handlePrevQuestion}
                disabled={currentQuestionIndex === 0}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <Button
                onClick={toggleMarkForReview}
                variant="outline"
                className={`rounded-xl ${markedForReview.has(currentQuestionIndex) ? 'border-warning text-warning' : ''}`}
              >
                <Flag className="h-4 w-4" />
              </Button>

              <Button
                onClick={handleNextQuestion}
                className="flex-1 nav-btn-next"
              >
                {isLastQuestion ? 'Submit' : 'Next'}
                {!isLastQuestion && <ChevronRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentInterface;
