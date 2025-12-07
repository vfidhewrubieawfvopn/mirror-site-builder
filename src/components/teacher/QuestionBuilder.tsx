import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useQuestions, Question } from '@/hooks/useQuestions';
import { useFileUpload } from '@/hooks/useFileUpload';
import { QuestionPreview } from './QuestionPreview';
import { Trash2, GripVertical, Upload, Plus, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuestionBuilderProps {
  testId: string;
  onQuestionsChange?: (questions: Question[]) => void;
}

export const QuestionBuilder = ({ testId, onQuestionsChange }: QuestionBuilderProps) => {
  const { toast } = useToast();
  const { createQuestion, fetchQuestions, deleteQuestion, reorderQuestions, loading } = useQuestions(testId);
  const { uploadMedia, uploading } = useFileUpload();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    question_type: 'mcq',
    difficulty: 'easy',
    question_text: '',
    marks: 1,
    options: ['', '', '', ''],
    correct_answer: '',
    order_index: 0,
  });
  const [isPassageQuestion, setIsPassageQuestion] = useState(false);
  const [passageId, setPassageId] = useState<string>('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadQuestions();
  }, [testId]);

  const loadQuestions = () => {
    const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
    const testQuestions = allQuestions.filter((q: Question) => q.test_id === testId);
    setQuestions(testQuestions);
    onQuestionsChange?.(testQuestions);
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question_text?.trim()) {
      toast({ title: 'Error', description: 'Please enter question text', variant: 'destructive' });
      return;
    }

    if (currentQuestion.question_type === 'mcq') {
      const filledOptions = currentQuestion.options?.filter(o => o.trim());
      if (!filledOptions || filledOptions.length < 2) {
        toast({ title: 'Error', description: 'Please add at least 2 options', variant: 'destructive' });
        return;
      }
      if (!currentQuestion.correct_answer) {
        toast({ title: 'Error', description: 'Please select the correct answer', variant: 'destructive' });
        return;
      }
    }

    const newQuestion: Question = {
      id: crypto.randomUUID(),
      test_id: testId,
      question_type: currentQuestion.question_type as any,
      difficulty: currentQuestion.difficulty as any,
      question_text: currentQuestion.question_text!,
      marks: currentQuestion.marks || 1,
      order_index: questions.length,
      passage_id: isPassageQuestion ? passageId || undefined : undefined,
      passage_text: currentQuestion.passage_text,
      passage_title: currentQuestion.passage_title,
      sub_question_label: currentQuestion.sub_question_label,
      options: currentQuestion.question_type === 'mcq' ? currentQuestion.options?.filter(o => o.trim()) : undefined,
      correct_answer: currentQuestion.correct_answer,
      media_url: currentQuestion.media_url,
      media_type: currentQuestion.media_type,
    };

    // Save to localStorage
    const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
    allQuestions.push(newQuestion);
    localStorage.setItem("questions", JSON.stringify(allQuestions));

    toast({ title: 'Success', description: 'Question created successfully' });
    loadQuestions();
    resetForm();
  };

  const handleDeleteQuestion = (id: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
      const filtered = allQuestions.filter((q: Question) => q.id !== id);
      localStorage.setItem("questions", JSON.stringify(filtered));
      toast({ title: 'Success', description: 'Question deleted successfully' });
      loadQuestions();
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mediaType = file.type.startsWith('image/') ? 'image' :
                     file.type.startsWith('audio/') ? 'audio' :
                     file.type.startsWith('video/') ? 'video' : null;

    if (!mediaType) {
      toast({ title: 'Error', description: 'Invalid file type', variant: 'destructive' });
      return;
    }

    const url = await uploadMedia(file, testId);
    if (url) {
      setCurrentQuestion(prev => ({ ...prev, media_url: url, media_type: mediaType }));
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newQuestions = [...questions];
    const draggedItem = newQuestions[draggedIndex];
    newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(index, 0, draggedItem);

    setQuestions(newQuestions);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null) {
      // Update order_index for all questions
      const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
      const updatedQuestions = questions.map((q, idx) => ({
        ...q,
        order_index: idx
      }));
      
      // Replace test questions with updated order
      const otherQuestions = allQuestions.filter((q: Question) => q.test_id !== testId);
      localStorage.setItem("questions", JSON.stringify([...otherQuestions, ...updatedQuestions]));
      
      toast({ title: 'Success', description: 'Questions reordered successfully' });
    }
    setDraggedIndex(null);
  };

  const resetForm = () => {
    setCurrentQuestion({
      question_type: 'mcq',
      difficulty: 'easy',
      question_text: '',
      marks: 1,
      options: ['', '', '', ''],
      correct_answer: '',
      order_index: 0,
    });
    setIsPassageQuestion(false);
    setEditingIndex(null);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(currentQuestion.options || ['', '', '', ''])];
    newOptions[index] = value;
    setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
  };

  return (
    <div className="grid lg:grid-cols-[60%_40%] gap-6">
      {/* Question Form */}
      <Card className="cloud-bubble p-6">
        <h3 className="text-xl font-semibold mb-4">Question Builder</h3>
        
        <div className="space-y-4">
            {/* Difficulty */}
            <div className="space-y-2">
              <Label>Difficulty Level</Label>
              <Select value={currentQuestion.difficulty} onValueChange={(v) => setCurrentQuestion(prev => ({ ...prev, difficulty: v as any }))}>
                <SelectTrigger className="input-glassy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Passage Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="passageCheck"
                  checked={isPassageQuestion}
                  onChange={(e) => setIsPassageQuestion(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="passageCheck">This is a passage-based question</Label>
              </div>
            </div>

            {isPassageQuestion && (
              <>
                <div className="space-y-2">
                  <Label>Passage Title</Label>
                  <Input
                    value={currentQuestion.passage_title || ''}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, passage_title: e.target.value }))}
                    placeholder="e.g., The Water Cycle"
                    className="input-glassy"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Passage Text (for first sub-question only)</Label>
                  <Textarea
                    value={currentQuestion.passage_text || ''}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, passage_text: e.target.value }))}
                    placeholder="Enter the reading passage..."
                    className="input-glassy min-h-[120px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sub-question Label (e.g., a, b, c)</Label>
                  <Input
                    value={currentQuestion.sub_question_label || ''}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, sub_question_label: e.target.value }))}
                    placeholder="a"
                    className="input-glassy"
                    maxLength={2}
                  />
                </div>
              </>
            )}

            {/* Question Text */}
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Textarea
                value={currentQuestion.question_text}
                onChange={(e) => setCurrentQuestion(prev => ({ ...prev, question_text: e.target.value }))}
                placeholder="Enter your question..."
                className="input-glassy"
              />
            </div>

            {/* MCQ Options */}
            {currentQuestion.question_type === 'mcq' && (
              <div className="space-y-3">
                <Label>Answer Options</Label>
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={currentQuestion.correct_answer === String.fromCharCode(65 + idx)}
                      onChange={() => setCurrentQuestion(prev => ({ ...prev, correct_answer: String.fromCharCode(65 + idx) }))}
                      className="w-4 h-4"
                    />
                    <span className="font-semibold w-6">{String.fromCharCode(65 + idx)}.</span>
                    <Input
                      value={currentQuestion.options?.[idx] || ''}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      className="input-glassy flex-1"
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Select the radio button for the correct answer</p>
              </div>
            )}

            {/* Marks */}
            <div className="space-y-2">
              <Label>Marks</Label>
              <Input
                type="number"
                value={currentQuestion.marks}
                onChange={(e) => setCurrentQuestion(prev => ({ ...prev, marks: parseInt(e.target.value) || 1 }))}
                min={1}
                max={10}
                className="input-glassy"
              />
            </div>

            {/* Media Upload */}
            <div className="space-y-2">
              <Label>Attach Media (optional)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="mediaUpload"
                  accept="image/*,audio/*,video/*"
                  onChange={handleMediaUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('mediaUpload')?.click()}
                  disabled={uploading}
                  className="rounded-xl"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Media'}
                </Button>
                {currentQuestion.media_url && (
                  <span className="text-sm text-success">✓ File attached</span>
                )}
              </div>
            </div>

            {/* Add Question Button */}
            <Button
              onClick={handleAddQuestion}
              disabled={loading || uploading}
              className="w-full nav-btn-next"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>
      </Card>

      {/* Live Preview */}
      <div className="space-y-4">
        <Card className="cloud-bubble p-4">
          <h3 className="text-lg font-semibold mb-3">Live Preview</h3>
          <p className="text-sm text-muted-foreground mb-4">See how students will view this question</p>
          {currentQuestion.question_text ? (
            <QuestionPreview
              question={currentQuestion as Question}
              questionNumber={questions.length + 1}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Start building a question to see the preview
            </div>
          )}
        </Card>
      </div>

      {/* Question List */}
      {questions.length > 0 && (
        <Card className="cloud-bubble p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Questions ({questions.length})</h3>
          <p className="text-sm text-muted-foreground mb-4">Drag to reorder</p>
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors cursor-move"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">
                    Q{idx + 1}{q.sub_question_label && q.sub_question_label}. {q.question_text.substring(0, 60)}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {q.question_type} • {q.difficulty} • {q.marks} marks
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDeleteQuestion(q.id!)}
                  className="rounded-xl"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
