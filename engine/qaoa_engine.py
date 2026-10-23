"""QAOA Max-Cut engine shared by the notebook and the web backend.

Conventions (identical to Qiskit): bit i of a basis-state index is qubit i, and
qubit i is node i. Bitstrings returned by this module are in *node order*
(character i = node i), i.e. Qiskit count keys are reversed before use.
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass, field

import networkx as nx
import numpy as np
from scipy.optimize import minimize


# ----------------------------------------------------------------------------
# Graph input
# ----------------------------------------------------------------------------
def parse_network(text: str):
    """Parse the [NODES]/[EDGES] text format. Returns (G, names)."""
    section, idx, names, edges = None, {}, [], []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.upper() == "[NODES]":
            section = "n"
            continue
        if line.upper() == "[EDGES]":
            section = "e"
            continue
        parts = line.split()
        if section == "n":
            if parts[0] in idx:
                raise ValueError(f"Duplicate node '{parts[0]}'")
            idx[parts[0]] = len(names)
            names.append(parts[0])
        elif section == "e":
            if len(parts) < 2:
                raise ValueError(f"Malformed edge line: '{line}'")
            for nm in parts[:2]:
                if nm not in idx:
                    raise ValueError(f"Edge references unknown node '{nm}'")
            w = float(parts[2]) if len(parts) > 2 else 1.0
            if w <= 0:
                raise ValueError(f"Edge weight must be positive: '{line}'")
            if parts[0] == parts[1]:
                raise ValueError(f"Self-loop not allowed: '{line}'")
            edges.append((idx[parts[0]], idx[parts[1]], w))
    if not names:
        raise ValueError("No nodes found - add a [NODES] section.")
    if not edges:
        raise ValueError("No edges found - add an [EDGES] section.")
    G = nx.Graph()
    for i, nm in enumerate(names):
        G.add_node(i, name=nm)
    for u, v, w in edges:
        G.add_edge(u, v, weight=w)
    return G, names


def graph_to_text(G, names) -> str:
    out = ["[NODES]", *names, "", "[EDGES]"]
    for u, v, d in G.edges(data=True):
        w = d.get("weight", 1)
        out.append(f"{names[u]} {names[v]} {w:g}")
    return "\n".join(out) + "\n"


def edge_arrays(G):
    e = np.array([(u, v, d.get("weight", 1.0)) for u, v, d in G.edges(data=True)])
    return e[:, 0].astype(int), e[:, 1].astype(int), e[:, 2].astype(float)


# ----------------------------------------------------------------------------
# Cost function
# ----------------------------------------------------------------------------
def cut_value(bits, G) -> float:
    """Weighted cut of a node-ordered bitstring / 0-1 sequence."""
    b = np.fromiter((int(c) for c in bits), dtype=np.int8) if isinstance(bits, str) else np.asarray(bits)
    u, v, w = edge_arrays(G)
    return float(np.sum(w * (b[u] != b[v])))


def basis_bits(n: int) -> np.ndarray:
    """(2^n, n) array; row = basis index, column i = bit of qubit i."""
    return ((np.arange(2**n)[:, None] >> np.arange(n)) & 1).astype(np.int8)


def cut_diagonal(G) -> np.ndarray:
    """Cut value of every one of the 2^n partitions (the diagonal of H_C)."""
    n = G.number_of_nodes()
    B = basis_bits(n)
    u, v, w = edge_arrays(G)
    d = np.zeros(2**n)
    for a, b, c in zip(u, v, w):
        d += c * (B[:, a] != B[:, b])
    return d


def index_to_bitstring(i: int, n: int) -> str:
    """Basis index -> node-ordered bitstring (character k = node k)."""
    return "".join(str((i >> k) & 1) for k in range(n))


def brute_force(G, diag=None):
    """Exact optimum by enumeration. Returns (best_cut, best_bitstring, n_optimal_states)."""
    d = cut_diagonal(G) if diag is None else diag
    best = d.max()
    idx = np.flatnonzero(np.isclose(d, best))
    return float(best), index_to_bitstring(int(idx[0]), G.number_of_nodes()), int(len(idx))


# ----------------------------------------------------------------------------
# Exact QAOA statevector simulation (fast, noiseless)
# ----------------------------------------------------------------------------
def _apply_mixer(psi, n, beta):
    c, s = math.cos(beta), -1j * math.sin(beta)
    for q in range(n):
        v = psi.reshape(2 ** (n - 1 - q), 2, 2**q)
        psi = (c * v + s * v[:, ::-1, :]).reshape(-1)
    return psi


def qaoa_probs(diag, n, gammas, betas) -> np.ndarray:
    """Measurement probabilities of |psi(gamma,beta)> = prod_k U_B(b_k) U_C(g_k) |+>^n."""
    psi = np.full(2**n, 2 ** (-n / 2), dtype=complex)
    for g, b in zip(gammas, betas):
        psi = psi * np.exp(-1j * g * diag)
        psi = _apply_mixer(psi, n, b)
    p = np.abs(psi) ** 2
    return p / p.sum()


@dataclass
class QAOAResult:
    gammas: np.ndarray
    betas: np.ndarray
    probs: np.ndarray
    history: list = field(default_factory=list)  # objective value <C> per evaluation
    n_evals: int = 0
    seconds: float = 0.0
    restart_scores: list = field(default_factory=list)


def optimise_qaoa(diag, n, p, shots=None, max_iter=200, restarts=1, seed=42, rhobeg=0.5):
    """COBYLA over (gamma, beta).

    shots=None -> exact expectation; shots=S -> expectation estimated from S samples
    per evaluation (what hardware would give). Restart choice always uses the exact value.
    """
    rng = np.random.default_rng(seed)
    best, best_exact, scores = None, -np.inf, []
    t0 = time.time()
    for r in range(restarts):
        hist = []

        def obj(x):
            pr = qaoa_probs(diag, n, x[:p], x[p:])
            if shots is None:
                e = float(pr @ diag)
            else:
                e = float(rng.multinomial(shots, pr) @ diag / shots)
            hist.append(e)
            return -e

        x0 = np.concatenate([rng.uniform(0, np.pi, p), rng.uniform(0, np.pi / 2, p)])
        res = minimize(obj, x0, method="COBYLA", options={"maxiter": max_iter, "rhobeg": rhobeg})
        pr = qaoa_probs(diag, n, res.x[:p], res.x[p:])
        exact = float(pr @ diag)
        scores.append(exact)
        if exact > best_exact:
            best_exact = exact
            best = QAOAResult(res.x[:p].copy(), res.x[p:].copy(), pr, hist, len(hist))
    best.seconds = time.time() - t0
    best.restart_scores = scores
    return best


def summarise(res: QAOAResult, diag, n, shots=2048, seed=0):
    """Honest quality metrics for a trained QAOA state."""
    opt = float(diag.max())
    mean_rand = float(diag.mean())
    exp_c = float(res.probs @ diag)
    p_opt = float(res.probs[np.isclose(diag, opt)].sum())
    counts = np.random.default_rng(seed).multinomial(shots, res.probs)
    sampled = np.flatnonzero(counts)
    best_idx = int(sampled[np.argmax(diag[sampled])])
    top_idx = int(np.argmax(res.probs))
    return {
        "optimum": opt,
        "random_mean": mean_rand,
        "expected_cut": exp_c,
        "expected_ratio": exp_c / opt,
        "p_optimal": p_opt,
        "best_sampled_cut": float(diag[best_idx]),
        "best_sampled_ratio": float(diag[best_idx]) / opt,
        "best_sampled_bitstring": index_to_bitstring(best_idx, n),
        "most_probable_bitstring": index_to_bitstring(top_idx, n),
        "most_probable_cut": float(diag[top_idx]),
        "counts": counts,
    }


# ----------------------------------------------------------------------------
# Qiskit circuit (what would run on hardware) and cross-checks
# ----------------------------------------------------------------------------
def build_qaoa_circuit(G, p, measure=True):
    """Parameterised QAOA circuit.  U_C(g) = exp(-i g H_C) = RZZ(-g*w) per edge (up to a global phase)."""
    from qiskit import QuantumCircuit
    from qiskit.circuit import ParameterVector

    n = G.number_of_nodes()
    gam, bet = ParameterVector("gamma", p), ParameterVector("beta", p)
    qc = QuantumCircuit(n)
    qc.h(range(n))
    for k in range(p):
        qc.barrier()
        for u, v, d in G.edges(data=True):
            qc.rzz(-gam[k] * d.get("weight", 1.0), u, v)
        qc.barrier()
        for q in range(n):
            qc.rx(2 * bet[k], q)
    if measure:
        qc.measure_all()
    return qc


def bind(qc, gammas, betas):
    """Bind by name; qc.parameters is alphabetical (beta before gamma), so positional zip would swap them."""
    m = {q.name: q for q in qc.parameters}
    vals = {f"gamma[{i}]": g for i, g in enumerate(gammas)}
    vals.update({f"beta[{i}]": b for i, b in enumerate(betas)})
    return qc.assign_parameters({m[k]: v for k, v in vals.items()})


def circuit_probs(G, p, gammas, betas) -> np.ndarray:
    """Probabilities from Qiskit's own statevector, for verifying the numpy engine."""
    from qiskit.quantum_info import Statevector

    qc = build_qaoa_circuit(G, p, measure=False)
    return Statevector(bind(qc, gammas, betas)).probabilities()


def sample_circuit(G, p, gammas, betas, shots=2048, noise_backend=None, seed=7, optimization_level=3):
    """Run the Qiskit circuit on AerSimulator (ideal, or noisy if a fake backend is given).

    Returns {node-ordered bitstring: count} and the transpiled circuit.
    """
    from qiskit import transpile
    from qiskit_aer import AerSimulator

    qc = build_qaoa_circuit(G, p)
    bound = bind(qc, gammas, betas)
    sim = AerSimulator.from_backend(noise_backend) if noise_backend is not None else AerSimulator()
    t = transpile(bound, sim, optimization_level=optimization_level, seed_transpiler=seed)
    counts = sim.run(t, shots=shots, seed_simulator=seed).result().get_counts()
    return {k[::-1]: v for k, v in counts.items()}, t


# ----------------------------------------------------------------------------
# Classical baselines
# ----------------------------------------------------------------------------
def greedy_flip(G, restarts=10, seed=0):
    """1-flip local search from random starts."""
    rng = np.random.default_rng(seed)
    n = G.number_of_nodes()
    adj = [[(j, d.get("weight", 1.0)) for j, d in G[i].items()] for i in range(n)]
    best, best_b = -1.0, None
    for _ in range(restarts):
        z = rng.integers(0, 2, n)
        improved = True
        while improved:
            improved = False
            for i in rng.permutation(n):
                gain = sum(w * (1 if z[i] == z[j] else -1) for j, w in adj[i])
                if gain > 1e-12:
                    z[i] ^= 1
                    improved = True
        c = cut_value(z, G)
        if c > best:
            best, best_b = c, z.copy()
    return best, "".join(map(str, best_b))


def spectral_bisection(G):
    """Sign of the dominant eigenvector of the weighted Laplacian."""
    import scipy.sparse as sp
    import scipy.sparse.linalg as sla

    n = G.number_of_nodes()
    L = nx.laplacian_matrix(G, nodelist=range(n), weight="weight").astype(float)
    if n <= 400:
        vals, vecs = np.linalg.eigh(L.toarray())
        vec = vecs[:, -1]
    else:
        _, vecs = sla.eigsh(L, k=1, which="LA")
        vec = vecs[:, 0]
    z = (vec > 0).astype(int)
    return cut_value(z, G), "".join(map(str, z))


def louvain_two_way(G, seed=0):
    """Louvain communities, merged into two groups by exhaustive search over community colourings."""
    comms = nx.community.louvain_communities(G, weight="weight", seed=seed)
    k = len(comms)
    label = {}
    for ci, c in enumerate(comms):
        for v in c:
            label[v] = ci
    u, v, w = edge_arrays(G)
    cu, cv = np.array([label[a] for a in u]), np.array([label[b] for b in v])
    if k > 20:
        k = 20
        cu, cv = cu % 20, cv % 20
    best, best_mask = -1.0, 0
    for mask in range(2 ** (k - 1)):
        col = (mask >> np.arange(k)) & 1
        c = float(np.sum(w * (col[cu] != col[cv])))
        if c > best:
            best, best_mask = c, mask
    col = (best_mask >> np.arange(k)) & 1
    z = "".join(str(int(col[label[i] % k])) for i in range(G.number_of_nodes()))
    return cut_value(z, G), z, len(comms)


def goemans_williamson(G, trials=20, seed=0):
    """SDP relaxation + random-hyperplane rounding. Returns (avg_cut, best_cut, sdp_upper_bound, best_bitstring)."""
    import cvxpy as cp

    n = G.number_of_nodes()
    W = nx.to_numpy_array(G, nodelist=range(n), weight="weight")
    X = cp.Variable((n, n), PSD=True)
    obj = cp.Maximize(0.25 * cp.sum(cp.multiply(W, 1 - X)))
    prob = cp.Problem(obj, [cp.diag(X) == 1])
    prob.solve(solver=cp.SCS, eps=1e-6)
    ub = float(prob.value)
    vals, vecs = np.linalg.eigh(X.value)
    V = vecs * np.sqrt(np.clip(vals, 0, None))
    rng = np.random.default_rng(seed)
    cuts, best, best_z = [], -1.0, None
    for _ in range(trials):
        z = (V @ rng.normal(size=n) > 0).astype(int)
        c = cut_value(z, G)
        cuts.append(c)
        if c > best:
            best, best_z = c, z
    return float(np.mean(cuts)), float(best), ub, "".join(map(str, best_z))


# ----------------------------------------------------------------------------
# Scalable hybrid: block-coordinate QAOA for graphs far beyond qubit limits
# ----------------------------------------------------------------------------
def _bfs_blocks(G, k, rng):
    """Split nodes into connected-ish chunks of at most k nodes (random BFS order)."""
    seen, blocks = set(), []
    nodes = list(G.nodes())
    for s in rng.permutation(nodes):
        s = int(s)
        if s in seen:
            continue
        queue, cur = [s], []
        seen.add(s)
        while queue and len(cur) < k:
            x = queue.pop(0)
            cur.append(x)
            nb = [int(y) for y in G[x] if y not in seen]
            rng.shuffle(nb)
            for y in nb:
                seen.add(y)
                queue.append(y)
        # unvisited queued nodes are released for later blocks
        for y in queue:
            seen.discard(y)
        blocks.append(cur)
    return blocks


def block_diag(G, block, z):
    """Cut contribution of `block` as a diagonal over its 2^k states, with the rest of z fixed."""
    k = len(block)
    B = basis_bits(k)
    pos = {v: i for i, v in enumerate(block)}
    d = np.zeros(2**k)
    for v in block:
        for nb, dat in G[v].items():
            w = dat.get("weight", 1.0)
            if nb in pos:
                if pos[v] < pos[nb]:
                    d += w * (B[:, pos[v]] != B[:, pos[nb]])
            else:
                d += w * (B[:, pos[v]] != z[nb])
    return d


def block_qaoa(G, block_size=12, p=2, sweeps=3, shots=1024, max_iter=60, seed=0, z0=None, log=None):
    """Hybrid solver: fix everything but a <=block_size block, solve that block with QAOA, repeat.

    A block update is accepted only if it does not lower the cut, so the result is never worse than z0.
    Each block needs only `block_size` qubits regardless of the full graph size.
    """
    rng = np.random.default_rng(seed)
    n = G.number_of_nodes()
    z = rng.integers(0, 2, n).astype(np.int8) if z0 is None else np.array(z0, dtype=np.int8)
    trace, n_blocks, t0 = [cut_value(z, G)], 0, time.time()
    for s in range(sweeps):
        for block in _bfs_blocks(G, block_size, rng):
            k = len(block)
            if k < 2:
                continue
            d = block_diag(G, block, z)
            res = optimise_qaoa(d, k, p, shots=None, max_iter=max_iter, seed=int(rng.integers(1 << 30)))
            counts = rng.multinomial(shots, res.probs)
            cand = np.flatnonzero(counts)
            best = int(cand[np.argmax(d[cand])])
            cur = int(sum(int(z[v]) << i for i, v in enumerate(block)))
            if d[best] > d[cur]:
                for i, v in enumerate(block):
                    z[v] = (best >> i) & 1
            n_blocks += 1
        trace.append(cut_value(z, G))
        if log:
            log(f"sweep {s + 1}/{sweeps}: cut = {trace[-1]:.1f}")
    return {
        "z": z,
        "cut": trace[-1],
        "trace": trace,
        "blocks_solved": n_blocks,
        "seconds": time.time() - t0,
        "qubits_per_block": block_size,
    }


def make_social_graph(n, m=3, seed=0, wmax=3):
    """Scale-free (Barabasi-Albert) graph with integer interaction weights 1..wmax."""
    rng = np.random.default_rng(seed)
    G = nx.barabasi_albert_graph(n, m, seed=seed)
    for u, v in G.edges():
        G[u][v]["weight"] = float(rng.integers(1, wmax + 1))
    return G
