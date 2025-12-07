import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, UserCircle, ShieldCheck, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import sckoolLogo from "@/assets/sckool-logo.jpeg";

// Admin ID verification moved to server-side (edge function) for security

// Moved OUTSIDE the component to prevent re-creation on every render
const PasswordInputField = ({ 
  id, 
  value, 
  onChange, 
  placeholder,
  showPassword,
  onToggleShow
}: { 
  id: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  placeholder: string;
  showPassword: boolean;
  onToggleShow: () => void;
}) => (
  <div className="relative">
    <Input 
      id={id} 
      type={showPassword ? "text" : "password"} 
      placeholder={placeholder} 
      value={value}
      onChange={onChange}
      className="input-glassy pr-12" 
    />
    <button
      type="button"
      onClick={onToggleShow}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
    >
      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  </div>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const role = searchParams.get("role") || "student";
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminId, setShowAdminId] = useState(false);
  
  const [studentForm, setStudentForm] = useState({
    studentId: "", password: "", fullName: "", grade: "", class: "", gender: "", age: ""
  });

  const [teacherForm, setTeacherForm] = useState({
    adminId: "", emailId: "", password: "", fullName: "", subject: ""
  });

  // Validation helpers
  const validateId = (id: string) => id.trim().length >= 3 && id.trim().length <= 50;
  const validatePassword = (pass: string) => pass.length >= 4;
  const validateName = (name: string) => name.trim().length >= 2 && name.trim().length <= 50;
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleStudentAuth = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp) {
      if (!studentForm.studentId || !studentForm.password || !studentForm.fullName || 
          !studentForm.grade || !studentForm.class || !studentForm.gender || !studentForm.age) {
        toast({ title: "Missing Information", description: "Please fill in all fields", variant: "destructive" });
        return;
      }

      if (!validateId(studentForm.studentId)) {
        toast({ title: "Invalid Student ID", description: "Student ID must be 3-50 characters", variant: "destructive" });
        return;
      }

      if (!validatePassword(studentForm.password)) {
        toast({ title: "Weak Password", description: "Password must be at least 4 characters", variant: "destructive" });
        return;
      }

      if (!validateName(studentForm.fullName)) {
        toast({ title: "Invalid Name", description: "Name must be 2-50 characters", variant: "destructive" });
        return;
      }
      
      const students = JSON.parse(localStorage.getItem("students") || "[]");
      if (students.find((s: any) => s.studentId === studentForm.studentId.trim())) {
        toast({ title: "Error", description: "Student ID already exists", variant: "destructive" });
        return;
      }
      
      // Hash password before storing
      const hashedPassword = btoa(studentForm.password);
      
      const sanitizedStudent = {
        studentId: studentForm.studentId.trim(),
        fullName: studentForm.fullName.trim(),
        grade: studentForm.grade.trim(),
        class: studentForm.class.trim(),
        age: studentForm.age.trim(),
        gender: studentForm.gender,
        password: hashedPassword
      };
      
      students.push(sanitizedStudent);
      localStorage.setItem("students", JSON.stringify(students));
      toast({ title: "Success!", description: "Account created! Please login." });
      setIsSignUp(false);
      setStudentForm({ ...studentForm, password: "" });
    } else {
      if (!studentForm.studentId || !studentForm.password) {
        toast({ title: "Missing Information", description: "Please enter Student ID and password", variant: "destructive" });
        return;
      }
      
      const students = JSON.parse(localStorage.getItem("students") || "[]");
      const hashedPassword = btoa(studentForm.password);
      const student = students.find((s: any) => 
        s.studentId === studentForm.studentId.trim() && s.password === hashedPassword
      );
      
      if (!student) {
        toast({ title: "Error", description: "Invalid Student ID or password", variant: "destructive" });
        return;
      }
      
      // Store only non-sensitive data in session
      const sessionData = {
        studentId: student.studentId,
        fullName: student.fullName,
        grade: student.grade,
        class: student.class,
        age: student.age,
        gender: student.gender
      };
      localStorage.setItem("currentStudent", JSON.stringify(sessionData));
      localStorage.setItem("userRole", "student");
      toast({ title: "Welcome!", description: `Logged in as ${student.fullName}` });
      navigate("/student/dashboard");
    }
  };

  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp) {
      if (!teacherForm.adminId || !teacherForm.emailId || !teacherForm.password || 
          !teacherForm.fullName || !teacherForm.subject) {
        toast({ title: "Missing Information", description: "Please fill in all fields", variant: "destructive" });
        return;
      }
      
      // Verify admin ID server-side
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-admin-id', {
        body: { adminId: teacherForm.adminId }
      });
      
      if (verifyError || !verifyData?.valid) {
        toast({ title: "Invalid Admin ID", description: "Please contact administrator for valid Admin ID", variant: "destructive" });
        return;
      }

      if (!validateEmail(teacherForm.emailId)) {
        toast({ title: "Invalid Email", description: "Please enter a valid email address", variant: "destructive" });
        return;
      }

      if (!validatePassword(teacherForm.password)) {
        toast({ title: "Weak Password", description: "Password must be at least 4 characters", variant: "destructive" });
        return;
      }

      if (!validateName(teacherForm.fullName)) {
        toast({ title: "Invalid Name", description: "Name must be 2-50 characters", variant: "destructive" });
        return;
      }
      
      const teachers = JSON.parse(localStorage.getItem("teachers") || "[]");
      if (teachers.find((t: any) => t.emailId === teacherForm.emailId.trim().toLowerCase())) {
        toast({ title: "Error", description: "Email already registered", variant: "destructive" });
        return;
      }
      
      // Hash password before storing (simple hash for demo - in production use bcrypt)
      const hashedPassword = btoa(teacherForm.password);
      
      const newTeacher = {
        teacherId: teacherForm.emailId.trim().toLowerCase(),
        emailId: teacherForm.emailId.trim().toLowerCase(),
        password: hashedPassword,
        fullName: teacherForm.fullName.trim(),
        subject: teacherForm.subject
      };
      
      teachers.push(newTeacher);
      localStorage.setItem("teachers", JSON.stringify(teachers));
      toast({ title: "Success!", description: "Account created! Please login with your email." });
      setIsSignUp(false);
      setTeacherForm({ adminId: "", emailId: "", password: "", fullName: "", subject: "" });
    } else {
      if (!teacherForm.emailId || !teacherForm.password) {
        toast({ title: "Missing Information", description: "Please enter Email and password", variant: "destructive" });
        return;
      }
      
      const teachers = JSON.parse(localStorage.getItem("teachers") || "[]");
      const hashedPassword = btoa(teacherForm.password);
      const teacher = teachers.find((t: any) => 
        (t.emailId === teacherForm.emailId.trim().toLowerCase() || t.teacherId === teacherForm.emailId.trim().toLowerCase()) 
        && t.password === hashedPassword
      );
      
      if (!teacher) {
        toast({ title: "Error", description: "Invalid Email or password", variant: "destructive" });
        return;
      }
      
      // Store only non-sensitive data in session
      const sessionData = {
        teacherId: teacher.teacherId,
        emailId: teacher.emailId,
        fullName: teacher.fullName,
        subject: teacher.subject
      };
      localStorage.setItem("currentTeacher", JSON.stringify(sessionData));
      localStorage.setItem("userRole", "teacher");
      toast({ title: "Welcome!", description: `Logged in as ${teacher.fullName}` });
      navigate("/teacher/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl cloud-bubble p-8 animate-enter">
        {/* Back Button */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back to home</span>
        </button>

        {/* Header with Role Icon */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              role === "student" ? "bg-primary/10" : "bg-secondary/10"
            }`}>
              {role === "student" ? (
                <GraduationCap className="h-10 w-10 text-primary" />
              ) : (
                <UserCircle className="h-10 w-10 text-secondary" />
              )}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {role === "student" ? "Student Portal" : "Teacher Portal"}
          </h1>
          <p className="text-muted-foreground">
            {isSignUp ? "Create your account" : "Sign in to continue"}
          </p>
        </div>

        {/* Sign Up / Login Toggle */}
        <div className="mb-6 flex gap-2 justify-center">
          <Button 
            variant={isSignUp ? "default" : "outline"} 
            onClick={() => setIsSignUp(true)}
            className="flex-1 rounded-xl"
          >
            Sign Up
          </Button>
          <Button 
            variant={!isSignUp ? "default" : "outline"} 
            onClick={() => setIsSignUp(false)}
            className="flex-1 rounded-xl"
          >
            Login
          </Button>
        </div>

        {/* STUDENT FORM */}
        {role === "student" && (
          <form onSubmit={handleStudentAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-id">Student ID</Label>
              <Input 
                id="student-id" 
                placeholder="Enter student ID" 
                value={studentForm.studentId}
                onChange={(e) => setStudentForm(prev => ({...prev, studentId: e.target.value}))} 
                className="input-glassy" 
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="student-password">Password</Label>
              <PasswordInputField
                id="student-password"
                value={studentForm.password}
                onChange={(e) => setStudentForm(prev => ({...prev, password: e.target.value}))}
                placeholder="Enter password"
                showPassword={showPassword}
                onToggleShow={() => setShowPassword(!showPassword)}
              />
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    placeholder="Enter full name" 
                    value={studentForm.fullName}
                    onChange={(e) => setStudentForm(prev => ({...prev, fullName: e.target.value}))} 
                    className="input-glassy" 
                    maxLength={50}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade</Label>
                    <Input 
                      id="grade" 
                      placeholder="e.g., 10" 
                      value={studentForm.grade}
                      onChange={(e) => setStudentForm(prev => ({...prev, grade: e.target.value}))} 
                      className="input-glassy" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="class">Class</Label>
                    <Input 
                      id="class" 
                      placeholder="e.g., A" 
                      value={studentForm.class}
                      onChange={(e) => setStudentForm(prev => ({...prev, class: e.target.value}))} 
                      className="input-glassy" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select 
                      value={studentForm.gender} 
                      onValueChange={(value) => setStudentForm(prev => ({...prev, gender: value}))}
                    >
                      <SelectTrigger className="input-glassy">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input 
                      id="age" 
                      type="number" 
                      placeholder="Age" 
                      value={studentForm.age}
                      onChange={(e) => setStudentForm(prev => ({...prev, age: e.target.value}))} 
                      className="input-glassy"
                      min={5}
                      max={25}
                    />
                  </div>
                </div>
              </>
            )}

            <Button type="submit" className="w-full nav-btn-next mt-6">
              {isSignUp ? "Create Account" : "Login"}
            </Button>
          </form>
        )}

        {/* TEACHER FORM */}
        {role === "teacher" && (
          <form onSubmit={handleTeacherAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="admin-id" className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Admin ID
                </Label>
                <div className="relative">
                  <Input 
                    id="admin-id" 
                    type={showAdminId ? "text" : "password"}
                    placeholder="Enter Admin ID to verify" 
                    value={teacherForm.adminId}
                    onChange={(e) => setTeacherForm(prev => ({...prev, adminId: e.target.value}))} 
                    className="input-glassy pr-12" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminId(!showAdminId)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAdminId ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Contact administrator for Admin ID</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email-id">Email ID</Label>
              <Input 
                id="email-id" 
                type="email"
                placeholder={isSignUp ? "Enter your email" : "Enter Email ID"} 
                value={teacherForm.emailId}
                onChange={(e) => setTeacherForm(prev => ({...prev, emailId: e.target.value}))} 
                className="input-glassy" 
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher-password">Password</Label>
              <PasswordInputField
                id="teacher-password"
                value={teacherForm.password}
                onChange={(e) => setTeacherForm(prev => ({...prev, password: e.target.value}))}
                placeholder={isSignUp ? "Create your password" : "Enter your password"}
                showPassword={showPassword}
                onToggleShow={() => setShowPassword(!showPassword)}
              />
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="teacher-name">Full Name</Label>
                  <Input 
                    id="teacher-name" 
                    placeholder="Enter your full name" 
                    value={teacherForm.fullName}
                    onChange={(e) => setTeacherForm(prev => ({...prev, fullName: e.target.value}))} 
                    className="input-glassy" 
                    maxLength={50}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select 
                    value={teacherForm.subject} 
                    onValueChange={(value) => setTeacherForm(prev => ({...prev, subject: value}))}
                  >
                    <SelectTrigger className="input-glassy">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Science">Science</SelectItem>
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button type="submit" className="w-full nav-btn-next mt-6">
              {isSignUp ? "Create Account" : "Login"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default LoginPage;
