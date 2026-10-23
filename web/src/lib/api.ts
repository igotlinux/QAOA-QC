export const API = process.env.NEXT_PUBLIC_API ?? "http://127.0.0.1:8000";

export type GraphNode = { id: number; name: string; group: number };
export type GraphEdge = { source: number; target: number; weight: number; cut: boolean };
export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };

export type SolveParams = {
  network_text?: string | null;
  random_nodes?: number | null;
  p: number;
  shots: number;
  max_iter: number;
  restarts: number;
  seed: number;
  with_circuit_image?: boolean;
};

export type SolveResult = {
  graph: GraphData;
  optimum: { cut: number; bitstring: string; optimal_states: number; total_weight: number };
  qaoa: {
    p: number;
    gammas: number[];
    betas: number[];
    history: number[];
    evals: number;
    seconds: number;
    metrics: {
      expected_cut: number;
      expected_ratio: number;
      p_optimal: number;
      best_sampled_cut: number;
      best_sampled_ratio: number;
      best_sampled_bitstring: string;
      most_probable_bitstring: string;
      most_probable_cut: number;
      random_mean: number;
    };
    top: { bitstring: string; probability: number; exact_probability: number; cut: number }[];
    groups: { A: string[]; B: string[] };
  };
  baselines: Record<string, number>;
  circuit: { qubits: number; rzz_per_layer: number; rx_per_layer: number; layers: number; two_qubit_gates_cx: number };
  circuit_png?: string;
};

export type DepthResult = {
  optimum: number;
  random_mean: number;
  rows: { p: number; expected_ratio: number; p_optimal: number; best_sampled_cut: number; evals: number; history: number[] }[];
};

export type ScaleResult = {
  nodes: number;
  edges: number;
  total_weight: number;
  random: number;
  block_qaoa: { cut: number; trace: number[]; blocks: number; seconds: number; qubits_per_block: number };
  greedy: { cut: number };
  spectral: { cut: number };
  wall_seconds: number;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  } catch {
    throw new Error("Cannot reach the QAOA backend on port 8000. Start it with backend/run.sh.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  health: () => call<{ ok: boolean; qiskit: string }>("/api/health"),
  sample: () => call<{ text: string; graph: GraphData }>("/api/sample-network"),
  results: () => call<Record<string, any>>("/api/results"),
  solve: (b: SolveParams) => call<SolveResult>("/api/solve", { method: "POST", body: JSON.stringify(b) }),
  depth: (b: SolveParams) => call<DepthResult>("/api/depth-compare", { method: "POST", body: JSON.stringify(b) }),
  scale: (b: { nodes: number; block_size: number; p: number; sweeps: number; seed: number }) =>
    call<ScaleResult>("/api/scale", { method: "POST", body: JSON.stringify(b) }),
};
