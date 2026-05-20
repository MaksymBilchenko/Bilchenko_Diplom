"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();

  const navItems = [
    { name: "Головна", href: "/" },
    ...(user ? [
      ...(user.role === "patient" ? [
        { name: "Записатись", href: "/book" },
        { name: "Мій кабінет", href: "/profile" }
      ] : []),
      ...(user.role === "admin" || user.role === "doctor" ? [
        { name: "Дашборд", href: "/dashboard" },
        { name: "Історія", href: "/dashboard/history" }
      ] : []),
    ] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200 transition-transform group-hover:scale-105">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Med<span className="text-blue-600">Queue</span>
              </span>
            </Link>

            <div className="hidden md:flex md:items-center md:gap-1">
              {!isLoading && navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!isLoading && (
              user ? (
                <div className="flex items-center gap-4">
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
                    <div className="flex justify-end">
                      <span className="mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                        {user.role === "admin" ? "Адміністратор" : user.role === "doctor" ? "Лікар" : "Пацієнт"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-200 active:scale-95"
                  >
                    Вийти
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-95"
                >
                  Увійти
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
