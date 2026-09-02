export default function Loading() { return <main className="min-h-screen p-8"><div className="h-8 w-56 animate-pulse rounded bg-foreground/10"/><div className="mt-8 grid gap-4 md:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-foreground/5"/>)}</div></main>; }

