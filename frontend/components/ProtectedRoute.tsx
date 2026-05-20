"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { Spinner } from "./ui/Spinner";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "patient" | "admin" | "doctor" | "staff";
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
      } else if (requiredRole) {
        const hasAccess = 
          user.role === requiredRole || 
          (requiredRole === "staff" && (user.role === "admin" || user.role === "doctor"));

        if (!hasAccess) {
          router.push(user.role === "patient" ? "/book" : "/dashboard");
        }
      }
    }
  }, [user, isLoading, requiredRole, router]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // If we are checking or unauthorized, return nothing to prevent "flashing"
  const hasAccess = !user ? false : !requiredRole ? true : (
    user.role === requiredRole || 
    (requiredRole === "staff" && (user.role === "admin" || user.role === "doctor"))
  );

  if (!user || !hasAccess) {
    return null;
  }

  return <>{children}</>;
}
