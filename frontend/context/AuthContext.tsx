"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchDoctors } from "@/lib/api";

interface User {
  id: number;
  email: string;
  role: "patient" | "admin" | "doctor";
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, role: "patient" | "admin" | "doctor") => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("med_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, role: "patient" | "admin" | "doctor") => {
    let id = 1;
    let name = email.split("@")[0];

    if (role === "admin") {
      name = "Головний реєстратор";
      id = 0;
    } else if (role === "doctor") {
      const doctors = await fetchDoctors();
      const doc = doctors.find(d => d.email === email);
      if (doc) {
        id = doc.id;
        name = doc.full_name;
      } else {
        throw new Error("Лікаря з таким email не знайдено");
      }
    } else if (role === "patient") {
       // В ідеалі тут має бути запит до fetchPatients, поки використовуємо mock ID
       // ID=1 - це Бондаренко з seed.py
       id = email === "savchenko@example.com" ? 2 : 1; 
    }

    const newUser: User = { id, email, role, name };
    setUser(newUser);
    localStorage.setItem("med_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("med_user");
    router.push("/");
  };

  // Role-based route protection logic
  useEffect(() => {
    if (!isLoading) {
      const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/book");
      const isAdminRoute = pathname.startsWith("/dashboard");

      if (isProtectedRoute && !user) {
        // Not logged in -> go to login
        router.push("/login");
      } else if (isAdminRoute && user && user.role === "patient") {
        // Logged in as patient but trying to access admin area -> redirect to /book
        router.push("/book");
      } else if (pathname === "/book" && user && (user.role === "admin" || user.role === "doctor")) {
        // Logged in as staff but trying to access patient area -> redirect to /dashboard
        router.push("/dashboard");
      }
    }
  }, [user, pathname, isLoading, router]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
