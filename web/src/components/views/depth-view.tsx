"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { api, type DepthResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ControlsPanel, toParams, useControls } from "@/components/controls";
import { DepthChart } from "@/components/charts";

export function DepthView() {
  const { c, set } = useControls();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<DepthResult | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.depth(toParams(c)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="font-serif text-[32px] leading-tight text-[var(--ink)]">Does a deeper circuit help?</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">
          The depth p is the number of cost and mixer rounds. More rounds add tunable angles and can raise the average cut, at the price of more gates, which matter on real noisy hardware.
          This trains p = 1, 2 and 3 on the same network.
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <section className="space-y-6 self-start rounded-lg border border-[var(--line)] bg-white p-5">
          <ControlsPanel c={c} set={set} disabled={busy} showDepth={false} />
          <Button onClick={run} disabled={busy} className="w-full bg-[var(--primary)] py-5 text-[14.5px] hover:bg-[#15216e]">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {busy ? "Training three circuits" : "Compare p = 1, 2, 3"}
          </Button>
          {err && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[13px] text-rose-900">{err}</p>}
        </section>
        <div className="min-w-0 space-y-6">
          {res ? (
            <>
              <section className="rounded-lg border border-[var(--line)] bg-white p-5">
                <h2 className="mb-3 text-[16px] font-semibold">Average cut during training</h2>
                <DepthChart rows={res.rows} />
              </section>
              <section className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-[13px] text-[var(--ink-2)]">
                      <th className="px-5 py-3 font-medium">Depth</th>
                      <th className="px-5 py-3 font-medium">Average cut / optimum</th>
                      <th className="px-5 py-3 font-medium">Chance a shot is optimal</th>
                      <th className="px-5 py-3 font-medium">Best of shots</th>
                      <th className="px-5 py-3 font-medium">Evaluations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.rows.map((r) => (
                      <tr key={r.p} className="border-b border-[var(--line)] last:border-0">
                        <td className="num px-5 py-3">p = {r.p}</td>
                        <td className="num px-5 py-3">{(r.expected_ratio * 100).toFixed(1)}%</td>
                        <td className="num px-5 py-3">{(r.p_optimal * 100).toFixed(2)}%</td>
                        <td className="num px-5 py-3">{r.best_sampled_cut} / {res.optimum}</td>
                        <td className="num px-5 py-3">{r.evals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-[var(--line)] px-5 py-3 text-[12.5px] text-[var(--muted-foreground)]">
                  A random split averages {((res.random_mean / res.optimum) * 100).toFixed(0)}% of the optimum. Results vary with the random start; the notebook repeats this over 10 seeds.
                </p>
              </section>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--line-strong)] bg-white py-24 text-center text-[14px] text-[var(--muted-foreground)]">Run the comparison to see the three training curves.</p>
          )}
        </div>
      </div>
    </div>
  );
}
