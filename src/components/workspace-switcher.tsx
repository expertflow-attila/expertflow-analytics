"use client";
import { useRouter } from "next/navigation";

export function WorkspaceSwitcher({ label, value, options }: { label: string; value: string; options: { label: string; url: string; value: string }[] }) {
  const router = useRouter();
  return <label className="grid gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><span>{label}</span>
    <select aria-label={label} className="h-9 rounded-lg border border-foreground/10 bg-background px-2 text-sm normal-case tracking-normal text-foreground" value={value} onChange={(event) => router.push(event.target.selectedOptions[0].dataset.url ?? "/")}>
      {options.map((option) => <option key={option.value} value={option.value} data-url={option.url}>{option.label}</option>)}
    </select>
  </label>;
}

