# QAOA-QC Project Guide

Plain-language explanation of the project, what was changed, what the results really say, and how to run and defend it. Written for someone new to the project.

## 1. What the project is

A social network is a graph: people are nodes, interactions are weighted edges. **Max-Cut** splits the people into two groups so the total weight of edges *crossing* the groups is as large as possible. It is NP-hard: with n users there are 2^n possible splits.

**QAOA** (Quantum Approximate Optimization Algorithm) uses one qubit per user (0 = group A, 1 = group B). A short circuit alternates a *cost layer* (an RZZ gate per edge) and a *mixer layer* (an RX gate per qubit), controlled by 2p angles (gamma, beta). A classical optimiser (COBYLA) tunes the angles so that good splits become likely when measured. Quantum circuit + classical tuner = *hybrid*.

Terms: `p` = number of layers, `shots` = measurements per evaluation, expected cut = average cut over measurements, P(optimal) = chance one measurement is an optimal cut.

## 2. Folder map

| Path | What it is |
|---|---|
| `notebooks/QAOA_MaxCut_Main.ipynb` | The single main notebook; produces every number in the paper. Executed, outputs saved. |
| `notebooks/_build_notebook.py` | Regenerates the notebook from `engine/qaoa_engine.py` |
| `engine/qaoa_engine.py` | Core code (fast exact simulator, Qiskit circuit, baselines, block-QAOA). Shared by notebook and web backend |
| `backend/` | FastAPI server (`run.sh`) |
| `web/` | Next.js + shadcn/ui front end |
| `results/results.json`, `results/figs/` | Saved results and figures from the notebook |
| `QAOA-Paper/` | LaTeX paper (`sn-article.tex` -> `sn-article.pdf`, 14 pages) |
| `legacy_py/` | Original scripts and the old Flask app, untouched except for being moved |
| `network.txt` | The paper's 16-user, 26-edge graph |
| `run_demo.sh` | Starts backend + web together |

## 3. How to run

```bash
./run_demo.sh                 # opens API on :8000 and UI on http://localhost:3000
cd QAOA-Paper && latexmk -pdf sn-article.tex
.venv/bin/jupyter lab notebooks/QAOA_MaxCut_Main.ipynb   # choose kernel "QAOA (.venv)"
```
Aer on Python 3.14 needs `GLIBC_TUNABLES=glibc.rtld.optional_static_tls=16384`; the Jupyter kernel and `backend/run.sh` already set it.

## 4. Bugs and errors found, and what was done

| # | Problem | Fix |
|---|---|---|
| 1 | Qiskit prints qubit 0 as the rightmost bit; old code scored bitstrings left to right, so the optimiser worked on a mirrored graph | Bitstrings reversed to node order everywhere |
| 2 | Old circuit used `rzz(2*gamma*w)`; the paper's cost unitary equals `rzz(-gamma*w)` up to a global phase | Circuit and paper Eq. (uc) corrected |
| 3 | `qc.parameters` is alphabetical (beta first), so gammas and betas were bound to each other's slots and reported swapped | Parameters bound by name |
| 4 | Paper: brute force over 2^16 states "~10 hours" | It takes about 8 ms |
| 5 | Paper: "95.5%" = best bitstring among 2048 samples, not the quality of the QAOA state; plain random sampling gets 96% of that | Metrics now: expected cut, P(optimal), best of shots, plus a random-sampling control |
| 6 | Paper: COBYLA "120-135 iterations"; real runs stop after 36-67 evaluations | Paper updated |
| 7 | Paper: Louvain 38, spectral 40, GW 41.5, greedy 38 had no code | Implemented; real values: Louvain 10 (modularity opposes cut), spectral 39, GW 41.95 avg / 44 best, greedy 44 |
| 8 | Paper: hub nodes with 5-7 connections, "scale-free" 16-node graph | Real degrees are 2-5; the claim was removed |
| 9 | Paper described data cleaning, edge sorting, graph coarsening as applied; none exist in code | Marked as proposed / removed |
| 10 | Paper and code limited to 15-16 nodes with no scaling evidence | Block-QAOA implemented and measured up to 20,000 nodes |
| 11 | `cn` package pulled in by the shadcn CLI | Replaced by `clsx` + `tailwind-merge` |
| 12 | `latexmk` failed on `\usepackage[mathscr]{mathalpha}` (unused) | Line removed |

## 5. What the results really say (honest version)

On the 16-user graph (optimum 44, random split 26):
- QAOA sampling finds an optimal cut at p = 1, 2, 3.
- But so do greedy local search, best-of-20 Goemans-Williamson, and plain random sampling in 14% of trials. **No quantum advantage is claimed.**
- QAOA does concentrate probability: P(optimal) is 1.0-2.8%, about 100-300 times a uniform guess. Expected-cut ratio is 0.80 (p=1), 0.80 (p=2), 0.85 (p=3) for the best of 5 restarts, and 0.70-0.72 averaged over 10 single-restart seeds with spread about 0.09-0.10. Depth differences are smaller than that spread.
- Noise (IBM Sherbrooke model): expected ratio 0.80 -> 0.74 at p=1 and 0.80 -> 0.68 at p=2. Deeper is worse on hardware.
- Block-QAOA (12-qubit blocks, p=2, 3 sweeps): 100 nodes 464 (greedy 457, GW 468, SDP bound 500); 300 nodes 1365 (greedy 1329); 1,000 nodes 4488 (4462); 3,000 nodes 13,811 (13,562). On 20,000 nodes one sweep gives 71.4% of total weight vs 74.6% for greedy.

## 6. What to say when asked "only 16 nodes for Instagram?"

> Nobody solves a billion-user graph as one circuit, quantum or classical. 16 nodes is our *validation* size: it is the largest where we can compare against the exact brute-force answer. For real scale we split the graph into small blocks of about a dozen users, let QAOA re-optimise one block while the rest is fixed, and sweep. Each block needs only about 12 qubits whatever the network size, work grows linearly with the number of users, and blocks can run in parallel. We ran this on up to 20,000 users. We do not claim a quantum speed-up; we claim a correct hybrid architecture, honest benchmarks and a path to hardware.

Weak points to be ready for: million-user figures are extrapolations of simulated block time; classical greedy is as good on small graphs; no run on real hardware has been done yet (the notebook has an optional cell: set `IBM_QUANTUM_TOKEN` in the shell, then `RUN_HARDWARE = True`).

## 7. Web demo (for the 24-10-2026 Teams session)

Tabs: **Solve a network** (paper/random/custom graph, partition view with a "pull groups apart" animation, convergence, measurements, comparison with classical, circuit), **Circuit depth** (p = 1, 2, 3), **Scale to thousands** (block-QAOA up to 3,000 users live), **Notebook results** (tables from `results.json`), **How it works**.

Design notes: cool paper-white ground, ink sidebar, indigo/amber for the two groups, rose for cut edges; Source Serif 4 for headings, IBM Plex Sans for UI, IBM Plex Mono for numbers. Stack: Next.js, shadcn/ui (base-nova), Recharts, d3-force; FastAPI + Qiskit behind it. Suggested demo order: Solve (paper network, p = 2) -> Measurements -> Versus classical (be upfront) -> Scale tab at 1,000 users -> Notebook results.

## 8. Evaluation facts (Notice PDF)
Group 3: Teams session on 24-10-2026 from 5 pm. Part 2 (60 marks) is the group project demo; suggested changes may be submitted until 2/11/2026.

## 9. Change log
- Paper follows the requested structure: Introduction, Literature Review, Proposed Model, Results and Discussion, Conclusion and Future Scope, then references. No Introduction or Literature Review subsections; the Discussion has two paragraphs.
- Abstract is exactly 250 words; Conclusion and Future Scope is 277 words; seven keywords. Citations and bibliography are ordered by first citation, and web-demo references were removed from the paper.
- Bibliography has 24 references; three added sources are Bravyi et al. (low-depth QAOA limitations), Lucas (Ising encodings), and Crooks (QAOA Max-Cut depth performance).
- The two architecture/pipeline figures are now native TikZ. Algorithms and block equations were checked against the engine; the paper distinguishes shot-based primary QAOA training from exact-expectation block training and identifies 1,024 shots as the block-update sampling count. The block objective was checked against direct edge scoring for all assignments of a test block.
- Corrected the effective-Hamiltonian sign explanation: because it differs from the full cost only by a constant, both are maximised. Statevector probabilities used for state-quality metrics are distinguished from measured shot frequencies.
- The Results tab had failed on legacy `NaN` baseline values because JSON does not permit `NaN`; the notebook now writes those values as `null`, and the API sanitizes existing result files too.
- Paper partition text now matches the saved Aer sample `0110010110001110`; captions are concise and describe their figures/tables.
- Paper compiles to 14 pages; Results, Methodology, Dataset, Hardware, Future and abstract use measured numbers; the three result figures are regenerated from the notebook (`fig_*.png`).
- The notebook includes a real IBM Runtime `SamplerV2` cell, disabled by default. It is implemented but has not been tested on physical hardware; no hardware result is included in the paper.
- The live graph uses label-aware vertical slots after partitioning and fits all nodes inside its viewBox; narrow screens can scroll the graph instead of shrinking labels.
- The Results API accepts legacy `NaN` values as JSON `null`; the notebook serializer now writes `null` for non-finite baseline fields.
- New engine, notebook, backend, web app, results files.
- Original Python files and the old Flask app moved to `legacy_py/`.
- Python environment: `.venv` with Qiskit 2.6.0, Aer 0.18.0, qiskit-ibm-runtime 0.51.0.
- Open items: optional real-hardware run; a new Impeccable skill version (4.7.0) is available.
