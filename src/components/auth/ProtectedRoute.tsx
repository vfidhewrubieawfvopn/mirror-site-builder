import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: "student" | "teacher";
}

const ProtectedRoute = ({ children, allowedRole }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    
    if (!userRole) {
      navigate("/", { replace: true });
      return;
    }

    if (allowedRole === "student") {
      const currentStudent = localStorage.getItem("currentStudent");
      if (userRole === "student" && currentStudent) {
        setIsAuthorized(true);
      } else {
        navigate("/", { replace: true });
      }
    } else if (allowedRole === "teacher") {
      const currentTeacher = localStorage.getItem("currentTeacher");
      if (userRole === "teacher" && currentTeacher) {
        setIsAuthorized(true);
      } else {
        navigate("/", { replace: true });
      }
    }

    setIsLoading(false);
  }, [allowedRole, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
