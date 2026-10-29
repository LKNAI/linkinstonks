// Gráfico de linha minúsculo para tabelas (volume mensal de 24 meses).
export function Sparkline({
  valores,
  cor,
  rotulo,
}: {
  valores: readonly number[];
  cor: string;
  rotulo: string;
}) {
  const w = 110;
  const h = 26;
  const max = Math.max(1, ...valores);
  const n = Math.max(1, valores.length - 1);
  const pts = valores.map((x, i) => [(i / n) * w, h - 2 - (x / max) * (h - 4)] as const);
  const linha = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={rotulo}>
      <title>{rotulo}</title>
      <path d={`${linha}L${w} ${h}L0 ${h}Z`} fill={cor} opacity={0.14} />
      <path d={linha} fill="none" stroke={cor} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
