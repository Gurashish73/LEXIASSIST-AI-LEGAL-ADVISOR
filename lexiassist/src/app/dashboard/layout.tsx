//src/app/dashboard/layout.tsx
import { ReactNode } from "react";

export default function DashboardLayout({
  children,
  caselist,
  analytics,
}: {
  children: ReactNode;
  caselist: ReactNode;
  analytics: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#08080a] text-zinc-200">
      {/* Sidebar (Placeholder for now) */}
      <aside className="w-64 border-r border-zinc-800/60 bg-[#0c0c0e] p-6 hidden md:block">
        <h2 className="text-lg font-light tracking-[0.2em] text-zinc-100 uppercase">LEXIASSIST</h2>
        <p className="mt-1 text-[10px] tracking-widest text-emerald-500 uppercase font-mono">Attorney Portal</p>
      </aside>

      {/* Main Dashboard Area */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-medium tracking-wide">Active Triage Overview</h1>
          <p className="text-sm text-zinc-500 mt-1">Review AI-generated Pre-Briefs and case analytics.</p>
        </header>

        {children}

      </main>
    </div>
  );
}