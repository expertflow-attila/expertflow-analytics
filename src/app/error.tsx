"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <main className="min-h-screen grid place-items-center p-6"><div className="text-center"><h1 className="text-3xl font-semibold">Something went wrong</h1><p className="mt-2 text-muted-foreground">The request could not be completed safely.</p><button onClick={reset} className="mt-6 rounded-lg bg-primary px-4 py-2 text-primary-foreground">Try again</button></div></main>; }

