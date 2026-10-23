export function CircuitSchematic({ n, p, edges }: { n: number; p: number; edges: number }) {
  const blockW = 150;
  const x0 = 24;
  const w = x0 + 90 + p * (blockW * 2 + 18) + 90;
  const rows = 6;
  const rowH = 26;
  const h = rows * rowH + 40;
  const qy = (i: number) => 30 + i * rowH;
  let x = x0;
  const parts: React.ReactNode[] = [];
  parts.push(<rect key="h" x={x} y={14} width={46} height={h - 28} rx={5} fill="#e7eafb" stroke="#3447d4" />, <text key="ht" x={x + 23} y={h / 2 + 4} textAnchor="middle" fontSize="13" fill="#1b2a8a">H</text>);
  x += 70;
  for (let k = 0; k < p; k++) {
    parts.push(
      <g key={k}>
        <rect x={x} y={14} width={blockW} height={h - 28} rx={5} fill="#fdeaf1" stroke="#d6336c" />
        <text x={x + blockW / 2} y={h / 2 - 4} textAnchor="middle" fontSize="12.5" fill="#8f1d44">Cost layer {k + 1}</text>
        <text x={x + blockW / 2} y={h / 2 + 14} textAnchor="middle" fontSize="11.5" fill="#8f1d44">{edges} RZZ gates, one per edge</text>
        <rect x={x + blockW + 9} y={14} width={blockW} height={h - 28} rx={5} fill="#fff4d6" stroke="#f0a500" />
        <text x={x + blockW + 9 + blockW / 2} y={h / 2 - 4} textAnchor="middle" fontSize="12.5" fill="#6b4700">Mixer layer {k + 1}</text>
        <text x={x + blockW + 9 + blockW / 2} y={h / 2 + 14} textAnchor="middle" fontSize="11.5" fill="#6b4700">{n} RX gates, one per qubit</text>
      </g>,
    );
    x += blockW * 2 + 18;
  }
  parts.push(<rect key="m" x={x + 6} y={14} width={64} height={h - 28} rx={5} fill="#e6f5ee" stroke="#0f8a5f" />, <text key="mt" x={x + 38} y={h / 2 + 4} textAnchor="middle" fontSize="12.5" fill="#0b5c3f">measure</text>);
  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: Math.min(w, 760) }} className="h-auto w-full" role="img" aria-label={`QAOA circuit with ${p} layers on ${n} qubits`}>
          {Array.from({ length: rows }, (_, i) => (
            <line key={i} x1={4} x2={w - 4} y1={qy(i)} y2={qy(i)} stroke="#b4bccb" strokeWidth={1} />
          ))}
          {parts}
        </svg>
      </div>
      <p className="mt-2 text-[13px] text-[var(--ink-2)]">
        {n} qubits (one per user, only six wires drawn). Two-qubit gates after compiling to CNOTs: {2 * edges * p}.
      </p>
    </div>
  );
}
