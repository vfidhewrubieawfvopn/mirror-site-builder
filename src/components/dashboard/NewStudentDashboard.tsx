import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { BookOpen, TrendingUp, Award, LogOut, Code, ChartLine, History, User, ArrowLeft, CheckCircle, XCircle, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import sckoolLogo from "@/assets/sckool-logo.jpeg";

type ActiveSection = "home" | "performance" | "history" | "profile";

const NewStudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, signOut, loading } = useAuth();
  const [testCode, setTestCode] = useState("");
  const [testResults, setTestResults] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<ActiveSection>("home");

  useEffect(() => {
    if (!loading && user) {
      fetchResults();
    }
  }, [user, loading]);

  const fetchResults = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('test_results')
      .select(`
        *,
        tests(title, subject)
      `)
      .eq('student_id', user.id)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Error fetching results:', error);
    } else {
      setTestResults(data || []);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logged out", description: "See you next time!" });
  };

  const handleEnterTestCode = async () => {
    if (!testCode.trim()) {
      toast({ title: "Error", description: "Please enter a test code", variant: "destructive" });
      return;
    }

    if (testCode.length !== 6) {
      toast({ title: "Error", description: "Test code must be 6 characters", variant: "destructive" });
      return;
    }

    // Check if test exists
    const { data: test, error } = await supabase
      .from('tests')
      .select('*')
      .eq('test_code', testCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !test) {
      toast({ title: "Error", description: "Invalid test code", variant: "destructive" });
      return;
    }

    // Check if already taken
    const hasAlreadyTaken = testResults.some(r => r.test_id === test.id);
    if (hasAlreadyTaken) {
      toast({ title: "Already Taken", description: "You have already completed this test", variant: "destructive" });
      return;
    }

    // Store test data for assessment
    localStorage.setItem('currentTest', JSON.stringify(test));
    navigate('/assessment');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  // Calculate overall stats
  const totalCorrect = testResults.reduce((sum, r) => sum + (r.correct_answers || 0), 0);
  const totalWrong = testResults.reduce((sum, r) => sum + (r.wrong_answers || 0), 0);
  const totalQuestions = testResults.reduce((sum, r) => sum + (r.total_questions || 0), 0);
  const avgScore = testResults.length > 0 
    ? (testResults.reduce((sum, r) => sum + (r.score || 0), 0) / testResults.length).toFixed(1)
    : 0;

  const scoreData = testResults.slice(0, 10).reverse().map((r, i) => ({
    name: `Test ${i + 1}`,
    score: r.score || 0
  }));

  const subjectData = Object.entries(
    testResults.reduce((acc: any, r) => {
      const subject = r.tests?.subject || 'Unknown';
      acc[subject] = (acc[subject] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

  const renderSection = () => {
    switch (activeSection) {
      case "performance":
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Correct</p>
                    <p className="text-2xl font-bold text-success">{totalCorrect}</p>
                  </div>
                </div>
              </Card>
              <Card className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Wrong</p>
                    <p className="text-2xl font-bold text-destructive">{totalWrong}</p>
                  </div>
                </div>
              </Card>
              <Card className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{totalQuestions}</p>
                  </div>
                </div>
              </Card>
              <Card className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Average</p>
                    <p className="text-2xl font-bold">{avgScore}%</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="cloud-bubble p-6">
              <h3 className="text-xl font-semibold mb-2">Score Trend</h3>
              <p className="text-muted-foreground text-sm mb-4">Your performance over time</p>
              {scoreData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={scoreData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '1rem'
                      }} 
                    />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-12">No test data yet. Take a test to see your progress!</p>
              )}
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="cloud-bubble p-6">
                <h3 className="text-lg font-semibold mb-4">Tests by Subject</h3>
                {subjectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={subjectData} cx="50%" cy="50%" labelLine={false} label={(entry) => entry.name} outerRadius={80} fill="#8884d8" dataKey="value">
                        {subjectData.map((_, index) => (
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

              <Card className="cloud-bubble p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
                {testResults.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-success/10 rounded-xl">
                      <span className="text-sm font-medium">Accuracy Rate</span>
                      <span className="text-lg font-bold text-success">
                        {totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-primary/10 rounded-xl">
                      <span className="text-sm font-medium">Tests Completed</span>
                      <span className="text-lg font-bold text-primary">{testResults.length}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-secondary/10 rounded-xl">
                      <span className="text-sm font-medium">Best Score</span>
                      <span className="text-lg font-bold text-secondary">
                        {testResults.length > 0 ? Math.max(...testResults.map(r => r.score || 0)) : 0}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No data yet</p>
                )}
              </Card>
            </div>
          </div>
        );

      case "history":
        return (
          <Card className="cloud-bubble p-6 animate-fade-in">
            <h3 className="text-xl font-semibold mb-2">Test History</h3>
            <p className="text-muted-foreground text-sm mb-6">All your completed assessments</p>
            <div className="space-y-4">
              {testResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No tests taken yet. Enter a test code to get started!</p>
              ) : (
                testResults.map((result, idx) => (
                  <div key={idx} className="flex justify-between items-center p-5 bg-muted/30 rounded-2xl hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{result.tests?.title || 'Assessment'}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(result.completed_at).toLocaleDateString()} • {result.tests?.subject || 'General'}
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
                ))
              )}
            </div>
          </Card>
        );

      case "profile":
        return (
          <Card className="cloud-bubble p-8 animate-fade-in">
            <h3 className="text-xl font-semibold mb-2">Your Profile</h3>
            <p className="text-muted-foreground text-sm mb-6">Personal information</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="text-lg font-semibold mt-1">{user.email}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Full Name</p>
                  <p className="text-lg font-semibold mt-1">{profile?.full_name || 'Not set'}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Grade & Class</p>
                  <p className="text-lg font-semibold mt-1">{profile?.grade || '-'}-{profile?.class || '-'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Gender</p>
                  <p className="text-lg font-semibold mt-1">{profile?.gender || 'Not set'}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Age</p>
                  <p className="text-lg font-semibold mt-1">{profile?.age ? `${profile.age} years` : 'Not set'}</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-xl">
                  <p className="text-xs text-primary uppercase tracking-wide">Tests Completed</p>
                  <p className="text-lg font-semibold mt-1 text-primary">{testResults.length}</p>
                </div>
              </div>
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
                {activeSection === "home" ? "Student Dashboard" : (
                  activeSection === "performance" ? "Performance" :
                  activeSection === "history" ? "Test History" : "Profile"
                )}
              </h1>
              <p className="text-muted-foreground">Welcome back, {profile?.full_name || 'Student'}!</p>
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
            {/* Test Code Entry */}
            <Card className="cloud-bubble p-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Enter Test Code</h3>
                  <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                    <Input
                      placeholder="Enter 6-letter code (e.g., E1A2B3)"
                      value={testCode}
                      onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                      className="input-glassy uppercase text-lg tracking-wider"
                      maxLength={6}
                    />
                    <Button onClick={handleEnterTestCode} className="nav-btn-next px-8 whitespace-nowrap">
                      Start Test
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              <Card className="cloud-bubble p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tests Taken</p>
                    <p className="text-2xl font-bold">{testResults.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="cloud-bubble p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Average Score</p>
                    <p className="text-2xl font-bold">{avgScore}%</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Navigation Bubbles */}
            <div className="grid grid-cols-3 gap-6">
              <div
                onClick={() => setActiveSection("performance")}
                className="nav-bubble group cursor-pointer"
              >
                <ChartLine className="h-10 w-10 mb-3 text-primary group-hover:scale-110 transition-transform" />
                <p className="font-semibold">Performance</p>
                <p className="text-xs text-muted-foreground mt-1">View your stats</p>
              </div>

              <div
                onClick={() => setActiveSection("history")}
                className="nav-bubble group cursor-pointer"
              >
                <History className="h-10 w-10 mb-3 text-secondary group-hover:scale-110 transition-transform" />
                <p className="font-semibold">History</p>
                <p className="text-xs text-muted-foreground mt-1">Past tests</p>
              </div>

              <div
                onClick={() => setActiveSection("profile")}
                className="nav-bubble group cursor-pointer"
              >
                <User className="h-10 w-10 mb-3 text-accent group-hover:scale-110 transition-transform" />
                <p className="font-semibold">Profile</p>
                <p className="text-xs text-muted-foreground mt-1">Your details</p>
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

export default NewStudentDashboard;
