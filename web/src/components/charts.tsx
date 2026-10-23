"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SolveResult } from "@/lib/api";

const axis = { fontSize: 11, fill: "#556075" };
const grid = "#e3e6ec";

export function ConvergenceChart({ history, optimum, random }: { history: number[]; optimum: number; random: number }) {
  const data = history.map((v, i) => ({ i: i + 1, v }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="i" tick={axis} tickLine={false} axisLine={{ stroke: grid }} label={{ value: "optimiser evaluation", position: "insideBottom", offset: -2, fontSize: 11, fill: "#556075" }} height={36} />
        <YAxis domain={[Math.floor(random - 2), Math.ceil(optimum + 2)]} tick={axis} tickLine={false} axisLine={false} width={34} />
        <ReferenceLine y={optimum} stroke="#0f8a5f" strokeDasharray="4 4" label={{ value: `optimum ${optimum}`, fontSize: 11, fill: "#0f8a5f", position: "insideTopRight" }} />
        <ReferenceLine y={random} stroke="#8a93a6" strokeDasharray="2 4" label={{ value: `random split ${random.toFixed(1)}`, fontSize: 11, fill: "#556075", position: "insideBottomRight" }} />
        <Tooltip formatter={(v) => [Number(v).toFixed(2), "expected cut"]} labelFormatter={(l) => `evaluation ${l}`} />
        <Line type="monotone" dataKey="v" stroke="#3447d4" strokeWidth={2} dot={false} isAnimationActive animationDuration={1600} animationEasing="ease-out" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ProbabilityChart({ top, optimum }: { top: SolveResult["qaoa"]["top"]; optimum: number }) {
  const data = top.map((t) => ({ ...t, label: t.bitstring }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 18, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={{ ...axis, fontFamily: "var(--font-plex-mono)", fontSize: 9 }} interval={0} angle={-50} textAnchor="end" height={92} tickLine={false} axisLine={{ stroke: grid }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
        <Tooltip formatter={(v, _n, p) => [`${(Number(v) * 100).toFixed(2)}%  (cut ${p.payload.cut})`, "measured"]} />
        <Bar dataKey="probability" radius={[3, 3, 0, 0]} animationDuration={900}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.cut >= optimum ? "#0f8a5f" : d.cut >= optimum * 0.9 ? "#3447d4" : "#b4bccb"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BaselineChart({ baselines, qaoa, optimum }: { baselines: Record<string, number>; qaoa: SolveResult["qaoa"]["metrics"]; optimum: number }) {
  const rows = [
    { name: "Random split", v: baselines.random_mean, k: "base" },
    { name: "Louvain (2-way)", v: baselines.louvain, k: "base" },
    { name: "Spectral", v: baselines.spectral, k: "base" },
    { name: "Greedy 1-flip", v: baselines.greedy, k: "base" },
    ...(baselines.goemans_williamson_avg ? [{ name: "Goemans-Williamson", v: baselines.goemans_williamson_avg, k: "base" }] : []),
    { name: "Random sampling, best of shots", v: baselines.random_sampling_best_of_shots, k: "base" },
    { name: "QAOA expected cut", v: qaoa.expected_cut, k: "q" },
    { name: "QAOA best of shots", v: qaoa.best_sampled_cut, k: "q" },
  ].map((r) => ({ ...r, ratio: (r.v / optimum) * 100 }));
  return (
    <ResponsiveContainer width="100%" height={rows.length * 34 + 24}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 0 }}>
        <CartesianGrid stroke={grid} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={axis} tickLine={false} axisLine={{ stroke: grid }} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" tick={{ ...axis, fill: "#0b1220" }} width={170} tickLine={false} axisLine={false} />
        <Tooltip formatter={(_v, _n, p) => [`${p.payload.v.toFixed(1)} of ${optimum} (${p.payload.ratio.toFixed(1)}%)`, "cut"]} />
        <Bar dataKey="ratio" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, fill: "#0b1220", formatter: (v: unknown) => `${Number(v).toFixed(0)}%` }}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.k === "q" ? "#3447d4" : "#b4bccb"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DepthChart({ rows }: { rows: { p: number; history: number[] }[] }) {
  const max = Math.max(...rows.map((r) => r.history.length));
  const data = Array.from({ length: max }, (_, i) => ({ i: i + 1, ...Object.fromEntries(rows.map((r) => [`p${r.p}`, r.history[i] ?? null])) }));
  const colors = ["#8a93a6", "#3447d4", "#d6336c"];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="i" tick={axis} tickLine={false} axisLine={{ stroke: grid }} />
        <YAxis domain={["auto", "auto"]} tick={axis} tickLine={false} axisLine={false} width={34} />
        <Tooltip />
        {rows.map((r, i) => (
          <Line key={r.p} dataKey={`p${r.p}`} name={`p = ${r.p}`} stroke={colors[i]} strokeWidth={2} dot={false} connectNulls={false} animationDuration={1400} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SweepChart({ trace, total }: { trace: number[]; total: number }) {
  const data = trace.map((v, i) => ({ sweep: i, ratio: (v / total) * 100 }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="sweep" tick={axis} tickLine={false} axisLine={{ stroke: grid }} />
        <YAxis domain={[40, 100]} tick={axis} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}%`} />
        <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}% of total weight`, "cut"]} labelFormatter={(l) => `sweep ${l}`} />
        <Line dataKey="ratio" stroke="#3447d4" strokeWidth={2.2} dot={{ r: 4 }} animationDuration={900} />
      </LineChart>
    </ResponsiveContainer>
  );
}
