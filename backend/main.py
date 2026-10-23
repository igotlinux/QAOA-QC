"""FastAPI backend for the QAOA Max-Cut demo. Run: see backend/run.sh"""
from __future__ import annotations

import base64
import io
import json
import sys
import time
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import qaoa_engine as E  # noqa: E402

MAX_EXACT_NODES = 20
app = FastAPI(title="QAOA Max-Cut API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["*"], allow_headers=["*"])


class SolveRequest(BaseModel):
    network_text: str | None = None
    random_nodes: int | None = Field(default=None, ge=4, le=MAX_EXACT_NODES)
    p: int = Field(default=2, ge=1, le=4)
    shots: int = Field(default=2048, ge=128, le=16384)
    max_iter: int = Field(default=300, ge=20, le=600)
    restarts: int = Field(default=3, ge=1, le=8)
    seed: int = 42
    top_k: int = Field(default=10, ge=3, le=20)
    with_circuit_image: bool = False


class ScaleRequest(BaseModel):
    nodes: int = Field(default=300, ge=50, le=5000)
    block_size: int = Field(default=12, ge=6, le=16)
    p: int = Field(default=2, ge=1, le=3)
    sweeps: int = Field(default=3, ge=1, le=5)
    seed: int = 1


def _load_graph(req: SolveRequest):
    if req.network_text and req.network_text.strip():
        try:
            G, names = E.parse_network(req.network_text)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
    elif req.random_nodes:
        G = E.make_social_graph(req.random_nodes, m=2, seed=req.seed)
        names = [f"U{i + 1}" for i in range(req.random_nodes)]
    else:
        raise HTTPException(400, "Provide a network or a node count.")
    n = G.number_of_nodes()
    if not 3 <= n <= MAX_EXACT_NODES:
        raise HTTPException(400, f"Exact simulation supports 3-{MAX_EXACT_NODES} nodes (got {n}). Use the scalability tab for larger graphs.")
    if not nx_connected_ok(G):
        raise HTTPException(400, "Graph has isolated nodes; every node needs at least one edge.")
    return G, names


def nx_connected_ok(G) -> bool:
    return all(G.degree(i) > 0 for i in G.nodes())


def _graph_json(G, names, bits=None):
    return {
        "nodes": [{"id": i, "name": names[i], "group": int(bits[i]) if bits else 0} for i in G.nodes()],
        "edges": [{"source": u, "target": v, "weight": d.get("weight", 1.0), "cut": bool(bits and bits[u] != bits[v])}
                  for u, v, d in G.edges(data=True)],
    }


def _circuit_png(G, p) -> str:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    qc = E.build_qaoa_circuit(G, p, measure=False)
    fig = qc.draw("mpl", fold=60, scale=0.45)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


@app.get("/api/health")
def health():
    import qiskit
    return {"ok": True, "qiskit": qiskit.__version__}


@app.get("/api/sample-network")
def sample_network():
    text = (ROOT / "network.txt").read_text()
    G, names = E.parse_network(text)
    return {"text": text, "graph": _graph_json(G, names)}


@app.get("/api/results")
def results():
    f = ROOT / "results" / "results.json"
    if not f.exists():
        raise HTTPException(404, "Run notebooks/QAOA_MaxCut_Main.ipynb first to create results.json")
    return json.loads(f.read_text(), parse_constant=lambda _: None)


@app.post("/api/solve")
def solve(req: SolveRequest):
    G, names = _load_graph(req)
    n = G.number_of_nodes()
    diag = E.cut_diagonal(G)
    opt, opt_bits, n_opt = E.brute_force(G, diag)

    res = E.optimise_qaoa(diag, n, req.p, shots=req.shots, max_iter=req.max_iter, restarts=req.restarts, seed=req.seed)
    s = E.summarise(res, diag, n, shots=req.shots, seed=req.seed)
    best_bits = s["best_sampled_bitstring"]

    order = np.argsort(-s["counts"])[: req.top_k]
    top = [{"bitstring": E.index_to_bitstring(int(i), n), "probability": float(s["counts"][i] / req.shots),
            "exact_probability": float(res.probs[i]), "cut": float(diag[i])} for i in order if s["counts"][i] > 0]

    baselines = {"random_mean": float(diag.mean())}
    baselines["greedy"] = E.greedy_flip(G, 10, req.seed)[0]
    baselines["spectral"] = E.spectral_bisection(G)[0]
    baselines["louvain"] = E.louvain_two_way(G, req.seed)[0]
    if n <= 40:
        try:
            gw = E.goemans_williamson(G, trials=20, seed=req.seed)
            baselines["goemans_williamson_avg"], baselines["goemans_williamson_best"], baselines["sdp_upper_bound"] = gw[0], gw[1], gw[2]
        except Exception:  # solver failure must not break the demo
            pass
    rng = np.random.default_rng(req.seed)
    baselines["random_sampling_best_of_shots"] = float(np.mean([diag[rng.integers(0, 2**n, req.shots)].max() for _ in range(100)]))

    u, v, w = E.edge_arrays(G)
    qc_ops = {"qubits": n, "rzz_per_layer": G.number_of_edges(), "rx_per_layer": n, "layers": req.p,
              "two_qubit_gates_cx": 2 * G.number_of_edges() * req.p}

    out = {
        "graph": _graph_json(G, names, best_bits),
        "optimum": {"cut": opt, "bitstring": opt_bits, "optimal_states": n_opt, "total_weight": float(w.sum())},
        "qaoa": {
            "p": req.p, "gammas": res.gammas.tolist(), "betas": res.betas.tolist(),
            "history": res.history, "evals": res.n_evals, "seconds": res.seconds,
            "metrics": {k: s[k] for k in ("expected_cut", "expected_ratio", "p_optimal", "best_sampled_cut", "best_sampled_ratio",
                                           "best_sampled_bitstring", "most_probable_bitstring", "most_probable_cut", "random_mean")},
            "top": top,
            "groups": {"A": [names[i] for i, b in enumerate(best_bits) if b == "0"], "B": [names[i] for i, b in enumerate(best_bits) if b == "1"]},
        },
        "baselines": baselines,
        "circuit": qc_ops,
    }
    if req.with_circuit_image:
        out["circuit_png"] = _circuit_png(G, min(req.p, 2))
    return out


@app.post("/api/depth-compare")
def depth_compare(req: SolveRequest):
    G, names = _load_graph(req)
    n = G.number_of_nodes()
    diag = E.cut_diagonal(G)
    opt = float(diag.max())
    rows = []
    for p in (1, 2, 3):
        r = E.optimise_qaoa(diag, n, p, shots=req.shots, max_iter=req.max_iter, restarts=req.restarts, seed=req.seed)
        s = E.summarise(r, diag, n, shots=req.shots, seed=req.seed)
        rows.append({"p": p, "expected_ratio": s["expected_ratio"], "p_optimal": s["p_optimal"], "best_sampled_cut": s["best_sampled_cut"],
                     "evals": r.n_evals, "history": r.history})
    return {"optimum": opt, "random_mean": float(diag.mean()), "rows": rows}


@app.post("/api/scale")
def scale(req: ScaleRequest):
    H = E.make_social_graph(req.nodes, m=3, seed=req.seed)
    total = float(sum(d["weight"] for *_, d in H.edges(data=True)))
    t0 = time.time()
    bq = E.block_qaoa(H, block_size=req.block_size, p=req.p, sweeps=req.sweeps, shots=1024, max_iter=60, seed=req.seed)
    g = E.greedy_flip(H, restarts=3, seed=req.seed)
    sp = E.spectral_bisection(H)
    return {"nodes": req.nodes, "edges": H.number_of_edges(), "total_weight": total, "random": total / 2,
            "block_qaoa": {"cut": bq["cut"], "trace": bq["trace"], "blocks": bq["blocks_solved"], "seconds": bq["seconds"], "qubits_per_block": req.block_size},
            "greedy": {"cut": g[0]}, "spectral": {"cut": sp[0]}, "wall_seconds": time.time() - t0}
