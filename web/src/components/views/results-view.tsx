"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Any = Record<string, any>;

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-[var(--line)] text-left text-[var(--ink-2)]">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--line)] last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-2.5 ${j > 0 ? "num" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const f = (x: number, d = 1) => Number(x).toFixed(d);

export function ResultsView() {
  const [r, setR] = useState<Any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.results().then(setR).catch((e) => setErr(e.message));
  }, []);

  if (err) return <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-900">{err}</p>;
  if (!r) return <p className="text-sm text-[var(--muted-foreground)]">Loading results.</p>;

  const cmp = Object.entries(r.comparison as Any);
  const noise = Object.entries((r.noise_fake_sherbrooke ?? {}) as Any);
  const stab = Object.entries(r.stability_10_seeds as Any);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="font-serif text-[32px] leading-tight text-[var(--ink)]">Results from the notebook</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">
          Every number the paper quotes comes from <span className="num">notebooks/QAOA_MaxCut_Main.ipynb</span>. Qiskit {r.versions.qiskit}, Aer {r.versions.qiskit_aer}, Python {r.versions.python}.
        </p>
      </header>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="mb-2 text-[16px] font-semibold">Exact answer</h2>
        <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
          Checking all {r.brute_force.partitions.toLocaleString()} splits takes {f(r.brute_force.seconds * 1000, 0)} ms. The best cut is <b className="num">{r.brute_force.optimum}</b>, a random split averages <span className="num">{r.brute_force.random_mean_cut}</span>.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white">
        <h2 className="px-5 pt-4 text-[16px] font-semibold">QAOA against classical methods (16 users)</h2>
        <Table head={["Method", "Cut", "Share of optimum"]} rows={cmp.map(([k, v]: [string, Any]) => [k, f(v.cut), `${f(v.ratio_pct)}%`])} />
        <p className="border-t border-[var(--line)] px-5 py-3 text-[12.5px] text-[var(--muted-foreground)]">
          On 16 users classical methods match QAOA, and random sampling alone finds 42 to 44. We report this plainly: the contribution is a correct hybrid architecture with honest benchmarks, not a speed-up claim.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white">
        <h2 className="px-5 pt-4 text-[16px] font-semibold">Stability over 10 random seeds</h2>
        <Table head={["Depth", "Average cut / optimum", "Spread (std)", "Best of shots, mean", "Best of shots, worst"]}
          rows={stab.map(([p, v]: [string, Any]) => [`p = ${p}`, `${f(v.expected_ratio_mean * 100)}%`, `${f(v.expected_ratio_std * 100)} pts`, f(v.best_of_shots_mean), f(v.best_of_shots_min)])} />
      </section>

      {noise.length > 0 && (
        <section className="rounded-lg border border-[var(--line)] bg-white">
          <h2 className="px-5 pt-4 text-[16px] font-semibold">Effect of hardware noise (simulated IBM 127-qubit Sherbrooke)</h2>
          <Table head={["Depth", "Ideal average cut", "Noisy average cut", "Two-qubit gates", "Circuit depth"]}
            rows={noise.map(([p, v]: [string, Any]) => [`p = ${p}`, `${f(v.ideal_ratio * 100)}%`, `${f(v.noisy_ratio * 100)}%`, v.two_qubit_gates, v.depth])} />
        </section>
      )}

      <section className="rounded-lg border border-[var(--line)] bg-white">
        <h2 className="px-5 pt-4 text-[16px] font-semibold">Cost of scaling up (measured per-block time, extrapolated)</h2>
        <Table head={["Users", "Qubits if one circuit", "Qubits per block", "Blocks per sweep", "1 core", "1,000 workers"]}
          rows={(r.extrapolation as Any[]).map((e) => [e.nodes, e.monolithic_qubits, e.block_qubits, e.blocks_per_sweep, e.one_sweep_1_core, e.one_sweep_1000_workers])} />
        <p className="border-t border-[var(--line)] px-5 py-3 text-[12.5px] text-[var(--muted-foreground)]">
          Measured up to {r.large_run.nodes.toLocaleString()} users. Larger rows extrapolate simulated block time; real devices add queueing and shot latency.
        </p>
      </section>
    </div>
  );
}
