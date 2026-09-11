"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSigningUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setError("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-6 text-slate-900 sm:px-8">
      <div className="w-full max-w-md">
        <header className="mb-12 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <span className="brand-mark" aria-hidden="true">✓</span>
          </div>
          <h1 className="text-3xl font-black leading-tight text-slate-950">
            Family Checklist
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isSigningUp ? "Create your parent account" : "Welcome back"}
          </p>
        </header>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-2 text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold mb-2 text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : isSigningUp ? "Sign Up" : "Log In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSigningUp(!isSigningUp);
              setError("");
            }}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            {isSigningUp ? "Already have an account? Log in" : "Don't have an account? Sign up"}
          </button>
        </div>

        <p className="mt-8 text-center text-xs font-medium text-slate-400">
          One small step at a time.
        </p>
      </div>
    </main>
  );
}
