import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Upload, Users, TrendingUp, BarChart3, LogOut, Copy, PlusCircle, FolderOpen, ChartLine, ArrowLeft, Trash2, Edit, Save, X, FileQuestion, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { CreateTestWizard } from "@/components/teacher/CreateTestWizard";
import { TestEditor } from "@/components/teacher/TestEditor";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import sckoolLogo from "@/assets/sckool-logo.jpeg";

type ActiveSection = "home" | "create" | "tests" | "analytics" | "students";

const NewTeacherDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, signOut, loading } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<ActiveSection>("home");
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', subject: '', duration_minutes: 60 });
  const [editingQuestionsTestId, setEditingQuestionsTestId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && user) {
      fetchTests();
      fetchResults();
      fetchStudents();
    }
  }, [user, loading]);

  const fetchTests = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tests:', error);
      toast({ title: "Error", description: "Failed to load tests", variant: "destructive" });
    } else {
      setTests(data || []);
    }
  };

  const fetchResults = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('test_results')
      .select(`
        *,
        tests!inner(teacher_id)
      `)
      .eq('tests.teacher_id', user.id);

    if (error) {
      console.error('Error fetching results:', error);
    } else {
      setAllResults(data || []);
    }
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    
    if (!error && data) {
      setStudents(data);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logged out", description: "See you next time!" });
  };

  const copyTestCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Test code copied to clipboard" });
  };

  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm('Are you sure you want to delete this test? This action cannot be undone.')) {
      return;
    }

    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', testId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete test", variant: "destructive" });
    } else {
      setTests(tests.filter(t => t.id !== testId));
      toast({ title: "Test Deleted", description: "Test and all its questions have been deleted" });
    }
  };

  const handleEditTest = (test: any) => {
    setEditingTestId(test.id);
    setEditForm({
      title: test.title,
      subject: test.subject,
      duration_minutes: test.duration_minutes || 60
    });
  };

  const handleSaveEdit = async (testId: string) => {
    const { error } = await supabase
      .from('tests')
      .update({
        title: editForm.title,
        subject: editForm.subject,
        duration_minutes: editForm.duration_minutes
      })
      .eq('id', testId);

    if (error) {
      toast({ title: "Error", description: "Failed to update test", variant: "destructive" });
    } else {
      setTests(tests.map(t => t.id === testId ? { ...t, ...editForm } : t));
      toast({ title: "Test Updated", description: "Test details have been saved" });
    }
    
    setEditingTestId(null);
  };

  const handleCancelEdit = () => {
    setEditingTestId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  // Analytics calculations
  const avgScore = allResults.length > 0
    ? (allResults.reduce((sum, r) => sum + (r.score || 0), 0) / allResults.length).toFixed(1)
    : 0;

  const studentCount = new Set(allResults.map(r => r.student_id)).size;

  const genderPerformance = Object.entries(
    allResults.reduce((acc: any, r) => {
      const student = students.find((s: any) => s.user_id === r.student_id);
      const gender = student?.gender || 'Unknown';
      if (!acc[gender]) acc[gender] = { total: 0, count: 0 };
      acc[gender].total += r.score || 0;
      acc[gender].count += 1;
      return acc;
    }, {})
  ).map(([gender, data]: [string, any]) => ({
    gender,
    avgScore: parseFloat((data.total / data.count).toFixed(1))
  }));

  const classPerformance = Object.entries(
    allResults.reduce((acc: any, r) => {
      const student = students.find((s: any) => s.user_id === r.student_id);
      const className = student ? `${student.grade}-${student.class}` : 'Unknown';
      if (!acc[className]) acc[className] = { total: 0, count: 0 };
      acc[className].total += r.score || 0;
      acc[className].count += 1;
      return acc;
    }, {})
  ).map(([name, data]: [string, any]) => ({
    name,
    avgScore: parseFloat((data.total / data.count).toFixed(1))
  }));

  const performanceTrend = allResults
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
    .slice(-10)
    .map((r, i) => ({
      test: `T${i + 1}`,
      score: r.score || 0
    }));

  const difficultyDistribution = Object.entries(
    allResults.reduce((acc: any, r) => {
      const diff = r.difficulty_level || 'Unknown';
      acc[diff] = (acc[diff] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];

  // Render section content
  const renderSection = () => {
    switch (activeSection) {
      case "create":
        return (
          <CreateTestWizard
            teacherId={user.id}
            onComplete={(testCode) => {
              fetchTests();
              setActiveSection("tests");
            }}
            onCancel={() => setActiveSection("home")}
          />
        );

      case "tests":
        if (editingQuestionsTestId) {
          return (
            <TestEditor 
              testId={editingQuestionsTestId} 
              onClose={() => setEditingQuestionsTestId(null)} 
            />
          );
        }

        return (
          <Card className="cloud-bubble p-6 animate-fade-in">
            <h3 className="text-xl font-semibold mb-2">My Tests</h3>
            <p className="text-muted-foreground text-sm mb-6">All tests you've created</p>
            <div className="space-y-4">
              {tests.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No tests created yet. Click "Create Test" to get started!</p>
              ) : (
                tests.map((test, idx) => (
                  <div key={idx} className="p-5 bg-muted/30 rounded-2xl hover:bg-muted/50 transition-colors">
                    {editingTestId === test.id ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Test Title</Label>
                          <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            className="input-glassy"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Subject</Label>
                            <Select
                              value={editForm.subject}
                              onValueChange={(v) => setEditForm(prev => ({ ...prev, subject: v }))}
                            >
                              <SelectTrigger className="input-glassy">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="English">English</SelectItem>
                                <SelectItem value="Science">Science</SelectItem>
                                <SelectItem value="Mathematics">Mathematics</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Duration (minutes)</Label>
                            <Input
                              type="text"
                              value={editForm.duration_minutes.toString()}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setEditForm(prev => ({ ...prev, duration_minutes: parseInt(val) || 0 }));
                              }}
                              placeholder="e.g., 60"
                              className="input-glassy"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleSaveEdit(test.id)}
                            className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="rounded-xl"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{test.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {test.subject} • {test.duration_minutes || 60} min • {new Date(test.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right mr-2">
                            <p className="text-xl font-bold text-primary font-mono">{test.test_code}</p>
                            <p className="text-xs text-muted-foreground">Test Code</p>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyTestCode(test.test_code)}
                            className="rounded-xl"
                            title="Copy test code"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditTest(test)}
                            className="rounded-xl"
                            title="Edit test details"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setEditingQuestionsTestId(test.id)}
                            className="rounded-xl"
                            title="Edit questions"
                          >
                            <FileQuestion className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteTest(test.id)}
                            className="rounded-xl"
                            title="Delete test"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        );

      case "analytics":
        const testWiseAnalytics = tests.map(test => {
          const testResults = allResults.filter(r => r.test_id === test.id);
          const avgTestScore = testResults.length > 0 
            ? testResults.reduce((sum, r) => sum + (r.score || 0), 0) / testResults.length 
            : 0;
          const avgTimeSpent = testResults.length > 0 
            ? testResults.reduce((sum, r) => sum + (r.time_spent || 0), 0) / testResults.length 
            : 0;
          
          return {
            ...test,
            attemptCount: testResults.length,
            avgScore: Math.round(avgTestScore * 10) / 10,
            avgTimeMinutes: Math.round(avgTimeSpent / 60),
            results: testResults,
          };
        });

        return (
          <div className="space-y-6 animate-fade-in">
            <Card className="cloud-bubble p-6">
              <h3 className="text-xl font-semibold mb-4">Test-wise Analytics</h3>
              <div className="space-y-4">
                {testWiseAnalytics.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tests created yet</p>
                ) : (
                  testWiseAnalytics.map((test, idx) => (
                    <div key={idx} className="p-5 bg-muted/30 rounded-2xl">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-lg">{test.title}</h4>
                          <p className="text-sm text-muted-foreground">{test.subject} • Code: {test.test_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{test.avgScore}%</p>
                          <p className="text-xs text-muted-foreground">Avg Score</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="p-3 bg-background/50 rounded-xl">
                          <p className="text-xs text-muted-foreground">Attempts</p>
                          <p className="text-lg font-semibold">{test.attemptCount}</p>
                        </div>
                        <div className="p-3 bg-background/50 rounded-xl">
                          <p className="text-xs text-muted-foreground">Avg Time</p>
                          <p className="text-lg font-semibold">{test.avgTimeMinutes} min</p>
                        </div>
                        <div className="p-3 bg-background/50 rounded-xl">
                          <p className="text-xs text-muted-foreground">Duration</p>
                          <p className="text-lg font-semibold">{test.duration_minutes} min</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="cloud-bubble p-6">
                <h3 className="text-lg font-semibold mb-4">Performance by Gender</h3>
                {genderPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={genderPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="gender" stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '1rem' }} />
                      <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data yet</p>
                )}
              </Card>

              <Card className="cloud-bubble p-6">
                <h3 className="text-lg font-semibold mb-4">Performance by Class</h3>
                {classPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={classPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '1rem' }} />
                      <Bar dataKey="avgScore" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data yet</p>
                )}
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="cloud-bubble p-6">
                <h3 className="text-lg font-semibold mb-4">Score Trend</h3>
                {performanceTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={performanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="test" stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '1rem' }} />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data yet</p>
                )}
              </Card>

              <Card className="cloud-bubble p-6">
                <h3 className="text-lg font-semibold mb-4">Difficulty Distribution</h3>
                {difficultyDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={difficultyDistribution} cx="50%" cy="50%" labelLine={false} label={(entry) => entry.name} outerRadius={80} fill="#8884d8" dataKey="value">
                        {difficultyDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data yet</p>
                )}
              </Card>
            </div>
          </div>
        );

      case "students":
        return (
          <Card className="cloud-bubble p-6 animate-fade-in">
            <h3 className="text-xl font-semibold mb-2">Student Results</h3>
            <p className="text-muted-foreground text-sm mb-6">Individual student performance</p>
            <div className="space-y-4">
              {allResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No student results yet</p>
              ) : (
                allResults.map((result, idx) => {
                  const student = students.find(s => s.user_id === result.student_id);
                  const test = tests.find(t => t.id === result.test_id);
                  return (
                    <div key={idx} className="p-5 bg-muted/30 rounded-2xl hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-foreground">{student?.full_name || 'Unknown Student'}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {test?.title || 'Unknown Test'} • {result.difficulty_level || 'N/A'} level
                          </p>
                          <div className="flex gap-4 mt-2 text-xs">
                            <span className="text-success">✓ {result.correct_answers || 0} correct</span>
                            <span className="text-destructive">✗ {result.wrong_answers || 0} wrong</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-primary">{result.score}%</p>
                          <p className="text-xs text-muted-foreground">
                            {Math.floor((result.time_spent || 0) / 60)} min
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/10">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden shadow-md border-2 border-primary/20">
              <img src={sckoolLogo} alt="Sckool Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {activeSection === "home" ? "Teacher Dashboard" : (
                  activeSection === "create" ? "Create Test" :
                  activeSection === "tests" ? "My Tests" :
                  activeSection === "analytics" ? "Analytics" : "Students"
                )}
              </h1>
              <p className="text-muted-foreground">Welcome, {profile?.full_name || 'Teacher'}!</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="rounded-xl">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Back button when in a section */}
        {activeSection !== "home" && (
          <button
            onClick={() => setActiveSection("home")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Dashboard</span>
          </button>
        )}

        {activeSection === "home" ? (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <Card className="cloud-bubble p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tests Created</p>
                    <p className="text-2xl font-bold">{tests.length}</p>
                  </div>
                </div>
              </Card>
              <Card className="cloud-bubble p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Students</p>
                    <p className="text-2xl font-bold">{studentCount}</p>
                  </div>
                </div>
              </Card>
              <Card className="cloud-bubble p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Score</p>
                    <p className="text-2xl font-bold">{avgScore}%</p>
                  </div>
                </div>
              </Card>
              <Card className="cloud-bubble p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Tests</p>
                    <p className="text-2xl font-bold">{allResults.length}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Navigation Bubbles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div
                onClick={() => setActiveSection("create")}
                className="nav-bubble group cursor-pointer"
              >
                <PlusCircle className="h-10 w-10 mb-3 text-primary group-hover:scale-110 transition-transform" />
                <p className="font-semibold">Create Test</p>
                <p className="text-xs text-muted-foreground mt-1">Build a new assessment</p>
              </div>

              <div
                onClick={() => setActiveSection("tests")}
                className="nav-bubble group cursor-pointer"
              >
                <FolderOpen className="h-10 w-10 mb-3 text-secondary group-hover:scale-110 transition-transform" />
                <p className="font-semibold">My Tests</p>
                <p className="text-xs text-muted-foreground mt-1">View and manage tests</p>
              </div>

              <div
                onClick={() => setActiveSection("analytics")}
                className="nav-bubble group cursor-pointer"
              >
                <ChartLine className="h-10 w-10 mb-3 text-accent group-hover:scale-110 transition-transform" />
                <p className="font-semibold">Analytics</p>
                <p className="text-xs text-muted-foreground mt-1">Performance insights</p>
              </div>

              <div
                onClick={() => setActiveSection("students")}
                className="nav-bubble group cursor-pointer"
              >
                <Users className="h-10 w-10 mb-3 text-primary group-hover:scale-110 transition-transform" />
                <p className="font-semibold">Students</p>
                <p className="text-xs text-muted-foreground mt-1">View student results</p>
              </div>
            </div>
          </>
        ) : (
          renderSection()
        )}
      </div>
    </div>
  );
};

export default NewTeacherDashboard;
