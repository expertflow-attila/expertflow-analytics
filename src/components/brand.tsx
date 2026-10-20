import Link from "next/link";

export function Brand({ href = "/overview" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex flex-col gap-1.5"
      aria-label="Business Native – Analitikai rutin"
    >
      <span className="text-xl font-semibold leading-none tracking-[-0.055em] text-foreground">
        business native
      </span>
      <span className="font-mono text-[10px] leading-relaxed tracking-[0.2em] text-muted-foreground">
        ANALITIKAI RUTIN
      </span>
    </Link>
  );
}
