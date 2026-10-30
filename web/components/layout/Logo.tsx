type LogoProps = {
  /** Tamanho do símbolo em pixels; o texto ao lado escala com ele. */
  size?: number;
  /** `mark` mostra só o símbolo; `full` inclui o nome. */
  variant?: "full" | "mark";
  className?: string;
};

/**
 * Símbolo do linkinstonks: uma linha de gráfico em alta (os "stonks") feita de nós ligados (o "link"),
 * que é o que o site faz: liga empresas a escrituradores e BDRs a depositárias. O último nó em âmbar
 * marca o dado mais recente. O desenho é o mesmo de `app/icon.svg` (favicon): ajuste nos dois.
 */
export function Logo({ size = 28, variant = "full", className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        aria-hidden="true"
        focusable="false"
        className="shrink-0"
      >
        <rect width="48" height="48" rx="13" fill="var(--accent)" />
        <path
          d="M11 34 L19.5 25.5 L26 31 L36.5 15.5"
          fill="none"
          stroke="var(--on-accent)"
          strokeOpacity="0.95"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M29.5 14.5 H37 V22"
          fill="none"
          stroke="var(--on-accent)"
          strokeOpacity="0.95"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="11" cy="34" r="3.6" fill="var(--on-accent)" />
        <circle cx="19.5" cy="25.5" r="3.6" fill="var(--on-accent)" />
        <circle cx="26" cy="31" r="3.6" fill="var(--accent-soft)" />
      </svg>
      {variant === "mark" ? (
        <span className="sr-only">linkinstonks</span>
      ) : (
        <span className="leading-none tracking-tight" style={{ fontSize: Math.round(size * 0.58) }}>
          <span className="font-medium">linkin</span>
          <span className="font-bold" style={{ color: "var(--accent-hover)" }}>
            stonks
          </span>
        </span>
      )}
    </span>
  );
}
