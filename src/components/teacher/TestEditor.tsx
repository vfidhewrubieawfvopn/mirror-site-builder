import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Edit, Trash2, Save, Upload, Image, Music, Video, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import sckoolLogo from '@/assets/sckool-logo.jpeg';

interface Question {
  id: string;
  test_id: string;
  question_type: string;
  difficulty: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  marks: number;
  order_index: number;
  media_url?: string;
  media_type?: string;
  passage_id?: string;
  passage_title?: string;
  passage_text?: string;
}

interface Test {
  id: string;
  title: string;
  subject: string;
  duration_minutes: number;
  test_code: string;
}

interface TestEditorProps {
  testId: string;
  onClose: () => void;
}

export const TestEditor = ({ testId, onClose }: TestEditorProps) => {
  const { toast } = useToast();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Question>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test form state
  const [testForm, setTestForm] = useState({
    title: '',
    subject: '',
    duration_minutes: 60,
    description: '',
    target_grade: '',
    target_section: '',
  });

  useEffect(() => {
    loadData();
  }, [testId]);

  const loadData = async () => {
    setLoading(true);
    
    // Load test from localStorage first
    const allTests = JSON.parse(localStorage.getItem("tests") || "[]");
    const foundTest = allTests.find((t: any) => t.id === testId);
    
    if (foundTest) {
      setTest(foundTest);
      setTestForm({
        title: foundTest.title || '',
        subject: foundTest.subject || '',
        duration_minutes: foundTest.duration_minutes || 60,
        description: foundTest.description || '',
        target_grade: foundTest.target_grade || '',
        target_section: foundTest.target_section || '',
      });
    }

    // Load questions from localStorage
    const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
    const testQuestions = allQuestions
      .filter((q: Question) => q.test_id === testId)
      .sort((a: Question, b: Question) => a.order_index - b.order_index);
    setQuestions(testQuestions);
    
    setLoading(false);
  };

  const saveTestInfo = () => {
    const allTests = JSON.parse(localStorage.getItem("tests") || "[]");
    const testIndex = allTests.findIndex((t: any) => t.id === testId);
    
    if (testIndex !== -1) {
      allTests[testIndex] = {
        ...allTests[testIndex],
        ...testForm
      };
      localStorage.setItem("tests", JSON.stringify(allTests));
      setTest(allTests[testIndex]);
      toast({ title: "Saved", description: "Test information updated" });
    }
  };

  const startEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditForm({ ...q });
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setEditForm({});
  };

  const saveQuestion = () => {
    if (!editingQuestionId || !editForm.question_text) return;

    const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
    const updatedAll = allQuestions.map((q: Question) => 
      q.id === editingQuestionId ? { ...q, ...editForm } : q
    );
    localStorage.setItem("questions", JSON.stringify(updatedAll));

    setQuestions(prev => prev.map(q => 
      q.id === editingQuestionId ? { ...q, ...editForm } as Question : q
    ));
    setEditingQuestionId(null);
    setEditForm({});
    toast({ title: "Saved", description: "Question updated successfully" });
  };

  const deleteQuestion = (id: string) => {
    if (!window.confirm('Delete this question?')) return;

    const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
    const filtered = allQuestions.filter((q: Question) => q.id !== id);
    localStorage.setItem("questions", JSON.stringify(filtered));

    setQuestions(prev => prev.filter(q => q.id !== id));
    toast({ title: "Deleted", description: "Question removed" });
  };

  const addNewQuestion = () => {
    const newQ: Question = {
      id: crypto.randomUUID(),
      test_id: testId,
      question_type: 'mcq',
      difficulty: 'easy',
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: 'A',
      marks: 1,
      order_index: questions.length,
    };

    const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
    allQuestions.push(newQ);
    localStorage.setItem("questions", JSON.stringify(allQuestions));

    setQuestions(prev => [...prev, newQ]);
    startEditQuestion(newQ);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...(editForm.options || ['', '', '', ''])];
    newOptions[index] = value;
    setEditForm(prev => ({ ...prev, options: newOptions }));
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);

    try {
      // Determine media type
      let mediaType = 'file';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';
      else if (file.type.startsWith('video/')) mediaType = 'video';

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${testId}/${crypto.randomUUID()}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError, data } = await supabase.storage
        .from('test-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('test-files')
        .getPublicUrl(fileName);

      // Update edit form with media
      setEditForm(prev => ({
        ...prev,
        media_url: publicUrl,
        media_type: mediaType,
      }));

      toast({ title: "Uploaded", description: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded successfully` });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: "Upload Error", description: error.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeMedia = () => {
    setEditForm(prev => ({
      ...prev,
      media_url: undefined,
      media_type: undefined,
    }));
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'practice': return 'bg-accent/20 text-accent-foreground';
      case 'easy': return 'bg-success/20 text-success';
      case 'medium': return 'bg-warning/20 text-warning-foreground';
      case 'hard': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const renderMediaPreview = (url?: string, type?: string) => {
    if (!url) return null;

    return (
      <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
        {type === 'image' && (
          <img src={url} alt="Question media" className="max-h-48 w-auto mx-auto" />
        )}
        {type === 'audio' && (
          <audio controls className="w-full p-4">
            <source src={url} />
          </audio>
        )}
        {type === 'video' && (
          <video controls className="max-h-48 w-auto mx-auto">
            <source src={url} />
          </video>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <img src={sckoolLogo} alt="Sckool Logo" className="h-10 w-10 rounded-full" />
        <div>
          <h2 className="text-2xl font-semibold">Edit Test</h2>
          <p className="text-sm text-muted-foreground">Update test details and questions</p>
        </div>
      </div>

      {/* Test Information */}
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Test Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Test Title</Label>
            <Input
              value={testForm.title}
              onChange={(e) => setTestForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Final Exam - Mathematics"
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select
              value={testForm.subject}
              onValueChange={(v) => setTestForm(prev => ({ ...prev, subject: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Science">Science</SelectItem>
                <SelectItem value="Mathematics">Mathematics</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={testForm.description}
              onChange={(e) => setTestForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Test description..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Target Grade</Label>
            <Select
              value={testForm.target_grade}
              onValueChange={(v) => setTestForm(prev => ({ ...prev, target_grade: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target Section</Label>
            <Select
              value={testForm.target_section}
              onValueChange={(v) => setTestForm(prev => ({ ...prev, target_section: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {['Section A', 'Section B', 'Section C', 'Section D'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              value={testForm.duration_minutes}
              onChange={(e) => setTestForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 60 }))}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveTestInfo}>
            <Save className="h-4 w-4 mr-2" />
            Save Test Info
          </Button>
        </div>
      </Card>

      {/* Questions Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">Questions ({questions.length})</h3>
            <p className="text-sm text-muted-foreground">Edit questions or add new ones</p>
          </div>
          <Button onClick={addNewQuestion} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>

        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <p>No questions yet. Click "Add Question" to create one.</p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="border border-border rounded-xl overflow-hidden">
                {editingQuestionId === q.id ? (
                  /* Edit Mode */
                  <div className="p-5 space-y-4 bg-card">
                    <div className="space-y-2">
                      <Label>Question Text</Label>
                      <Textarea
                        value={editForm.question_text || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, question_text: e.target.value }))}
                        placeholder="Enter your question here..."
                        rows={3}
                      />
                    </div>

                    {/* Passage fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Passage Title (optional)</Label>
                        <Input
                          value={editForm.passage_title || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, passage_title: e.target.value }))}
                          placeholder="e.g., Reading Passage A"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Passage ID (for grouping)</Label>
                        <Input
                          value={editForm.passage_id || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, passage_id: e.target.value }))}
                          placeholder="e.g., passage-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Passage Text (optional)</Label>
                      <Textarea
                        value={editForm.passage_text || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, passage_text: e.target.value }))}
                        placeholder="Enter the reading passage here..."
                        rows={4}
                      />
                    </div>

                    {/* Media Upload */}
                    <div className="space-y-2">
                      <Label>Media (Image/Video/Audio)</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,audio/*,video/*"
                        onChange={handleMediaUpload}
                        className="hidden"
                        id={`media-upload-${q.id}`}
                      />
                      
                      {editForm.media_url ? (
                        <div className="space-y-2">
                          {renderMediaPreview(editForm.media_url, editForm.media_type)}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingMedia}
                              className="rounded-xl"
                            >
                              {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                              Replace
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={removeMedia}
                              className="rounded-xl text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => !uploadingMedia && fileInputRef.current?.click()}
                          className={`border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30 ${uploadingMedia ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {uploadingMedia ? (
                            <>
                              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
                              <p className="text-sm text-muted-foreground">Uploading...</p>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-center gap-4 mb-2">
                                <Image className="h-6 w-6 text-muted-foreground" />
                                <Music className="h-6 w-6 text-muted-foreground" />
                                <Video className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <p className="text-sm text-muted-foreground">Click to upload image, video, or audio</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <Select 
                          value={editForm.difficulty || 'easy'} 
                          onValueChange={(v) => setEditForm(prev => ({ ...prev, difficulty: v }))}
                        >
                          <SelectTrigger>
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
                      <div className="space-y-2">
                        <Label>Marks</Label>
                        <Input
                          type="number"
                          value={editForm.marks || 1}
                          onChange={(e) => setEditForm(prev => ({ ...prev, marks: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Options</Label>
                      <div className="space-y-2">
                        {['A', 'B', 'C', 'D'].map((letter, i) => (
                          <div key={letter} className="flex items-center gap-2">
                            <span className="w-8 h-8 flex items-center justify-center bg-muted rounded-lg text-sm font-medium">
                              {letter}
                            </span>
                            <Input
                              value={editForm.options?.[i] || ''}
                              onChange={(e) => updateOption(i, e.target.value)}
                              placeholder={`Option ${letter}`}
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Correct Answer</Label>
                      <Select 
                        value={editForm.correct_answer || 'A'} 
                        onValueChange={(v) => setEditForm(prev => ({ ...prev, correct_answer: v }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button variant="outline" onClick={cancelEditQuestion}>
                        Cancel
                      </Button>
                      <Button onClick={saveQuestion}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="p-4 bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-lg text-sm font-medium">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${getDifficultyColor(q.difficulty)}`}>
                              {q.difficulty}
                            </span>
                            <span className="text-xs text-muted-foreground">{q.marks} marks</span>
                            {q.media_url && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {q.media_type === 'image' ? '🖼️' : q.media_type === 'audio' ? '🎵' : '🎬'} Media
                              </span>
                            )}
                            {q.passage_id && (
                              <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">
                                📖 Passage
                              </span>
                            )}
                          </div>
                          <p className="text-foreground">{q.question_text || 'No question text'}</p>
                          
                          {/* Show media preview in view mode */}
                          {q.media_url && (
                            <div className="mt-3">
                              {renderMediaPreview(q.media_url, q.media_type)}
                            </div>
                          )}
                          
                          <div className="mt-3 space-y-1">
                            {q.options?.map((opt, i) => (
                              <div 
                                key={i}
                                className={`text-sm flex items-center gap-2 ${
                                  q.correct_answer === String.fromCharCode(65 + i) 
                                    ? 'text-success font-medium' 
                                    : 'text-muted-foreground'
                                }`}
                              >
                                <span className="w-5">{String.fromCharCode(65 + i)}.</span>
                                <span>{opt || '(empty)'}</span>
                                {q.correct_answer === String.fromCharCode(65 + i) && (
                                  <span className="text-xs bg-success/20 px-2 py-0.5 rounded">Correct</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditQuestion(q)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteQuestion(q.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
