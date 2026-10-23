"use client";

import { useEffect, useState } from "react";
import { Activity, BookOpen, FlaskConical, GitCompareArrows, Layers, Network } from "lucide-react";
import { api } from "@/lib/api";
import { SolveView } from "@/components/views/solve-view";
import { DepthView } from "@/components/views/depth-view";
import { ScaleView } from "@/components/views/scale-view";
import { ResultsView } from "@/components/views/results-view";
import { LearnView } from "@/components/views/learn-view";

const NAV = [
  { id: "solve", label: "Solve a network", icon: Network },
  { id: "depth", label: "Circuit depth", icon: Layers },
  { id: "scale", label: "Scale to thousands", icon: GitCompareArrows },
  { id: "results", label: "Notebook results", icon: FlaskConical },
  { id: "learn", label: "How it works", icon: BookOpen },
] as const;
type ViewId = (typeof NAV)[number]["id"];

export default function Home() {
  const [view, setView] = useState<ViewId>("solve");
  const [backend, setBackend] = useState<{ ok: boolean; qiskit?: string } | null>(null);

  useEffect(() => {
    api.health().then(setBackend).catch(() => setBackend({ ok: false }));
  }, []);

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col gap-8 border-b border-border bg-[#0b1220] px-5 py-6 text-[#e8ebf5] lg:sticky lg:top-0 lg:h-screen lg:border-b-0">
        <div>
          <p className="font-serif text-[22px] leading-tight">QAOA Community Lab</p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-[#9aa4bd]">Max-Cut community detection with a hybrid quantum-classical algorithm</p>
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col" aria-label="Sections">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] transition-colors ${
                view === id ? "bg-[#1f2c55] text-white" : "text-[#b6bfd6] hover:bg-[#161f3a] hover:text-white"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden text-[12px] text-[#9aa4bd] lg:block">
          <p className="flex items-center gap-2">
            <Activity className={`size-3.5 ${backend?.ok ? "text-emerald-400" : "text-rose-400"}`} aria-hidden />
            {backend === null ? "Connecting to engine" : backend.ok ? `Qiskit ${backend.qiskit} engine online` : "Engine offline"}
          </p>
          <p className="mt-3 leading-snug">COEP Tech, Group 3. Rohit Rao, Viraj Nalbalwar, Shreesh Kolhatkar, Om Shingare.</p>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-7 md:px-9 lg:py-9">
        {backend && !backend.ok && (
          <p role="alert" className="mb-5 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            The QAOA engine is not running. Start it with <span className="num">backend/run.sh</span>, then reload this page.
          </p>
        )}
        {view === "solve" && <SolveView />}
        {view === "depth" && <DepthView />}
        {view === "scale" && <ScaleView />}
        {view === "results" && <ResultsView />}
        {view === "learn" && <LearnView />}
      </main>
    </div>
  );
}
