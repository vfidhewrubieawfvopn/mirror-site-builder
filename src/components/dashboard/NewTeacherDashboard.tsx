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
import sckoolLogo from "@/assets/sckool-logo.jpeg";

type ActiveSection = "home" | "create" | "tests" | "analytics" | "students";

const NewTeacherDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<ActiveSection>("home");
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', subject: '', duration_minutes: 60 });
  const [editingQuestionsTestId, setEditingQuestionsTestId] = useState<string | null>(null);
  
  // Upload form
  const [testTitle, setTestTitle] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testDuration, setTestDuration] = useState("60");

  useEffect(() => {
    const currentTeacher = localStorage.getItem("currentTeacher");
    if (!currentTeacher) {
      navigate('/');
      return;
    }
    const teacherData = JSON.parse(currentTeacher);
    setTeacher(teacherData);

    const allTests = JSON.parse(localStorage.getItem("tests") || "[]");
    const teacherTests = allTests.filter((t: any) => t.teacherId === teacherData.teacherId);
    setTests(teacherTests);

    const results = JSON.parse(localStorage.getItem("testResults") || "[]");
    const teacherResults = results.filter((r: any) => 
      teacherTests.some((t: any) => t.testCode === r.testCode)
    );
    setAllResults(teacherResults);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentTeacher");
    localStorage.removeItem("userRole");
    toast({ title: "Logged out", description: "See you next time!" });
    navigate('/');
  };

  const generateTestCode = (subject: string) => {
    const prefix = subject === 'English' ? 'E' : subject === 'Science' ? 'S' : 'M';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = prefix;
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTitle || !testSubject) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    const testCode = generateTestCode(testSubject);
    const newTest = {
      id: crypto.randomUUID(),
      testCode,
      subject: testSubject,
      title: testTitle,
      duration_minutes: parseInt(testDuration),
      teacherId: teacher.teacherId,
      teacherName: teacher.fullName,
      createdAt: new Date().toISOString()
    };

    const allTests = JSON.parse(localStorage.getItem("tests") || "[]");
    allTests.push(newTest);
    localStorage.setItem("tests", JSON.stringify(allTests));

    toast({ 
      title: "Test Created!", 
      description: `Test code: ${testCode}`,
      duration: 5000
    });

    setTestTitle("");
    setTestSubject("");
    setTestDuration("60");
    setTests([...tests, newTest]);
  };

  const copyTestCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Test code copied to clipboard" });
  };

  const handleDeleteTest = (testId: string) => {
    if (!window.confirm('Are you sure you want to delete this test? This action cannot be undone.')) {
      return;
    }

    const allTests = JSON.parse(localStorage.getItem("tests") || "[]");
    const filtered = allTests.filter((t: any) => t.id !== testId);
    localStorage.setItem("tests", JSON.stringify(filtered));

    // Also delete associated questions
    const allQuestions = JSON.parse(localStorage.getItem("questions") || "[]");
    const filteredQuestions = allQuestions.filter((q: any) => q.test_id !== testId);
    localStorage.setItem("questions", JSON.stringify(filteredQuestions));

    setTests(filtered.filter((t: any) => t.teacherId === teacher.teacherId));
    toast({ title: "Test Deleted", description: "Test and all its questions have been deleted" });
  };

  const handleEditTest = (test: any) => {
    setEditingTestId(test.id);
    setEditForm({
      title: test.title,
      subject: test.subject,
      duration_minutes: test.duration_minutes || 60
    });
  };

  const handleSaveEdit = (testId: string) => {
    const allTests = JSON.parse(localStorage.getItem("tests") || "[]");
    const testIndex = allTests.findIndex((t: any) => t.id === testId);
    
    if (testIndex !== -1) {
      allTests[testIndex] = {
        ...allTests[testIndex],
        title: editForm.title,
        subject: editForm.subject,
        duration_minutes: editForm.duration_minutes
      };
      localStorage.setItem("tests", JSON.stringify(allTests));
      
      setTests(allTests.filter((t: any) => t.teacherId === teacher.teacherId));
      toast({ title: "Test Updated", description: "Test details have been saved" });
    }
    
    setEditingTestId(null);
  };

  const handleCancelEdit = () => {
    setEditingTestId(null);
  };

  if (!teacher) return null;

  // Analytics calculations
  const avgScore = allResults.length > 0
    ? (allResults.reduce((sum, r) => sum + (r.score || 0), 0) / allResults.length).toFixed(1)
    : 0;

  const students = JSON.parse(localStorage.getItem("students") || "[]");
  const studentCount = new Set(allResults.map(r => r.studentId)).size;

  const genderPerformance = Object.entries(
    allResults.reduce((acc: any, r) => {
      const student = students.find((s: any) => s.studentId === r.studentId);
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
      const student = students.find((s: any) => s.studentId === r.studentId);
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
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .slice(-10)
    .map((r, i) => ({
      test: `T${i + 1}`,
      score: r.score || 0
    }));

  const difficultyDistribution = Object.entries(
    allResults.reduce((acc: any, r) => {
      const diff = r.difficultyLevel || 'Unknown';
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
            teacherId={teacher.teacherId}
            onComplete={(testCode) => {
              // Reload tests from localStorage (CreateTestWizard already saved it)
              const allTests = JSON.parse(localStorage.getItem("tests") || "[]");
              setTests(allTests.filter((t: any) => t.teacherId === teacher.teacherId));
              setActiveSection("tests");
            }}
            onCancel={() => setActiveSection("home")}
          />
        );

      case "tests":
        // If editing questions for a test, show the TestEditor
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
                      // Edit Mode
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
                      // View Mode
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{test.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {test.subject} • {test.duration_minutes || test.durationMinutes || 60} min • {new Date(test.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right mr-2">
                            <p className="text-xl font-bold text-primary font-mono">{test.testCode}</p>
                            <p className="text-xs text-muted-foreground">Test Code</p>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyTestCode(test.testCode)}
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
        // Group results by test for test-wise analytics
        const testWiseAnalytics = tests.map(test => {
          const testResults = allResults.filter(r => r.testCode === test.testCode);
          const avgTestScore = testResults.length > 0 
            ? testResults.reduce((sum, r) => sum + (r.score || 0), 0) / testResults.length 
            : 0;
          const avgTimeSpent = testResults.length > 0 
            ? testResults.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / testResults.length 
            : 0;
          
          // Per-question timing (if available)
          const questionStats: Record<number, { totalTime: number; count: number; correct: number }> = {};
          testResults.forEach(result => {
            if (result.questionTiming) {
              Object.entries(result.questionTiming).forEach(([qIdx, time]) => {
                const idx = parseInt(qIdx);
                if (!questionStats[idx]) questionStats[idx] = { totalTime: 0, count: 0, correct: 0 };
                questionStats[idx].totalTime += time as number;
                questionStats[idx].count += 1;
              });
            }
          });
          
          return {
            ...test,
            attemptCount: testResults.length,
            avgScore: Math.round(avgTestScore * 10) / 10,
            avgTimeMinutes: Math.round(avgTimeSpent / 60),
            results: testResults,
            questionStats
          };
        });

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Test Selector for detailed view */}
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
                          <p className="text-sm text-muted-foreground">{test.subject} • Code: {test.testCode}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{test.avgScore}%</p>
                          <p className="text-xs text-muted-foreground">avg score</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="p-3 bg-background/50 rounded-xl text-center">
                          <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                          <p className="text-lg font-bold">{test.attemptCount}</p>
                          <p className="text-xs text-muted-foreground">Attempts</p>
                        </div>
                        <div className="p-3 bg-background/50 rounded-xl text-center">
                          <Clock className="h-5 w-5 mx-auto mb-1 text-secondary" />
                          <p className="text-lg font-bold">{test.avgTimeMinutes}m</p>
                          <p className="text-xs text-muted-foreground">Avg Time</p>
                        </div>
                        <div className="p-3 bg-background/50 rounded-xl text-center">
                          <TrendingUp className="h-5 w-5 mx-auto mb-1 text-accent-foreground" />
                          <p className="text-lg font-bold">
                            {test.results.length > 0 ? Math.max(...test.results.map(r => r.score || 0)) : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground">Top Score</p>
                        </div>
                      </div>

                      {/* Score distribution for this test */}
                      {test.results.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Score Distribution</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <BarChart data={test.results.slice(0, 10)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="studentId" hide />
                              <YAxis domain={[0, 100]} hide />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '0.5rem',
                                  fontSize: '12px'
                                }}
                                formatter={(value) => [`${value}%`, 'Score']}
                              />
                              <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Overall Stats */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="cloud-bubble p-6">
                <h3 className="text-lg font-semibold mb-4">Gender Performance</h3>
                {genderPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={genderPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="gender" stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
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
                <p className="text-muted-foreground text-center py-12">No student results yet. Share your test codes with students!</p>
              ) : (
                allResults.map((result, idx) => {
                  const student = students.find((s: any) => s.studentId === result.studentId);
                  return (
                    <div key={idx} className="flex justify-between items-center p-5 bg-muted/30 rounded-2xl hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-semibold text-foreground">{student?.fullName || 'Unknown Student'}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          ID: {result.studentId} • Grade {student?.grade}-{student?.class} • {student?.gender}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Test: {result.testTitle} • {result.difficultyLevel} • {new Date(result.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-primary">{result.score}%</p>
                        <p className="text-xs text-muted-foreground">
                          {Math.floor(result.timeSpent / 60)} min
                        </p>
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
              <p className="text-muted-foreground">Welcome, {teacher.fullName}!</p>
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
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
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
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
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
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Score</p>
                    <p className="text-2xl font-bold">{avgScore}%</p>
                  </div>
                </div>
              </Card>

              <Card className="cloud-bubble p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tests Taken</p>
                    <p className="text-2xl font-bold">{allResults.length}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Navigation Bubbles */}
            <h2 className="text-xl font-semibold mb-6">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <button onClick={() => setActiveSection("create")} className="nav-bubble">
                <div className="nav-bubble-icon">
                  <PlusCircle className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Create Test</h3>
                  <p className="text-sm text-muted-foreground mt-1">Generate new test</p>
                </div>
              </button>

              <button onClick={() => setActiveSection("tests")} className="nav-bubble">
                <div className="nav-bubble-icon">
                  <FolderOpen className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">My Tests</h3>
                  <p className="text-sm text-muted-foreground mt-1">View & manage</p>
                </div>
              </button>

              <button onClick={() => setActiveSection("analytics")} className="nav-bubble">
                <div className="nav-bubble-icon">
                  <ChartLine className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Analytics</h3>
                  <p className="text-sm text-muted-foreground mt-1">Performance data</p>
                </div>
              </button>

              <button onClick={() => setActiveSection("students")} className="nav-bubble">
                <div className="nav-bubble-icon">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Students</h3>
                  <p className="text-sm text-muted-foreground mt-1">Individual results</p>
                </div>
              </button>
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
