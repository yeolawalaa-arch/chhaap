import Link from "next/link";

/**
 * Chhaap's own mark — an imprint pressed into a surface, which is what the word
 * means. Built from the same geometric vocabulary the product generates, so the
 * platform is visibly made of its own material.
 */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="100" height="100" rx="26" fill="currentColor" />
      {/* A 'छ'-adjacent form: a stamped ring with a break and a pressed bar. */}
      <path
        d="M50 22a28 28 0 1 0 24 42"
        stroke="var(--color-brand-300)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M50 40v34" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
      <circle cx="72" cy="30" r="7" fill="var(--color-brand-400)" />
    </svg>
  );
}

export function Wordmark({
  size = 28,
  href = "/",
  className,
  showText = true,
}: {
  size?: number;
  href?: string | null;
  className?: string;
  showText?: boolean;
}) {
  const content = (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Mark size={size} className="text-ink" />
      {showText && (
        <span
          className="font-semibold tracking-[-0.02em] text-ink"
          style={{ fontFamily: "var(--font-display)", fontSize: size * 0.66 }}
        >
          Chhaap
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Chhaap home">
      {content}
    </Link>
  );
}
