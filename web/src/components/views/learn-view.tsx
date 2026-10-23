const STEPS = [
  { t: "Describe the network as a graph", d: "Each user is a node. A connection is an edge whose weight says how strongly the two interact (1 occasional, 2 regular, 3 frequent)." },
  { t: "Turn the goal into a score", d: "A split puts every user in group A or B. Its score is the total weight of edges that cross between the groups. Max-Cut asks for the split with the highest score. With n users there are 2^n splits, so checking them all stops being possible quickly." },
  { t: "Give every split to the quantum computer at once", d: "One qubit per user: 0 means group A, 1 means group B. Hadamard gates put all 2^n splits into superposition with equal weight." },
  { t: "Alternate cost and mixer layers", d: "The cost layer applies an RZZ gate to every connection and gives each split a phase that depends on its score. The mixer layer applies RX gates that let splits interfere. After p rounds, good splits are more likely than bad ones." },
  { t: "Measure, score, adjust", d: "We measure many shots, compute the average score, and let the classical optimiser (COBYLA) change the 2p angles gamma and beta. Repeat until the average stops improving." },
  { t: "Read off the communities", d: "The best split among the measured outcomes becomes group A and group B. For networks too big for one circuit, the same routine solves a block of about a dozen users at a time." },
];

export function LearnView() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-serif text-[32px] leading-tight text-[var(--ink)]">How the method works</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">The quantum part is small and the classical part steers it. That combination is why it is called hybrid.</p>
      </header>
      <ol className="space-y-5">
        {STEPS.map((s, i) => (
          <li key={s.t} className="grid grid-cols-[32px_1fr] gap-4">
            <span className="num flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[13px] text-[var(--accent-foreground)]">{i + 1}</span>
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">{s.t}</h2>
              <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--ink-2)]">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="rounded-lg border border-[var(--line)] bg-white p-5 text-[14px] leading-relaxed text-[var(--ink-2)]">
        <h2 className="mb-2 text-[16px] font-semibold text-[var(--ink)]">In symbols</h2>
        <p className="num">C(z) = sum over edges w_ij * [z_i != z_j]</p>
        <p className="num mt-1">H_C = sum over edges (w_ij / 2)(I - Z_i Z_j)</p>
        <p className="num mt-1">|psi&gt; = U_B(beta_p) U_C(gamma_p) ... U_B(beta_1) U_C(gamma_1) |+&gt;^n</p>
      </section>
    </div>
  );
}
