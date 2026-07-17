//src/app/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false, 
      });

      if (res?.error) {
        setError("Invalid email or password. Access denied.");
        setIsLoading(false);
      } else if (res?.ok) {
        // Unified Gateway: Route all authenticated users to the dashboard
        router.push("/dashboard");
        router.refresh(); 
      }
    } catch (err) {
      setError("A critical system error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#050505] flex items-center justify-center p-4 selection:bg-emerald-500/30 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md bg-[#0c0c0e]/95 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <span className="text-xl text-emerald-500">⚖️</span>
          </div>
          <h1 className="text-xl font-medium tracking-[0.15em] text-zinc-100 uppercase">LEXIASSIST</h1>
          <p className="text-[10px] font-mono tracking-widest text-emerald-500 uppercase mt-2">
            Secure Node Authorization
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-center shadow-inner">
              <p className="text-[10px] font-mono text-rose-400 uppercase tracking-widest">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#08080a] border border-zinc-800/80 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-[#0c0c0e] transition-all shadow-inner"
              placeholder="client@domain.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#08080a] border border-zinc-800/80 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-[#0c0c0e] transition-all shadow-inner"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full mt-6 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-medium text-sm px-4 py-3.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_25px_rgba(16,185,129,0.2)]"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-[10px] uppercase tracking-widest">Authenticating</span>
              </>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-widest">Initialize Session</span>
            )}
          </button>
        </form>
      </motion.div>
    </main>
  );
}