import Link from "next/link";
export default function NotFound() { return <main className="min-h-screen grid place-items-center p-6"><div className="text-center"><p className="font-mono text-sm text-muted-foreground">404</p><h1 className="mt-3 text-3xl font-semibold">Workspace not found</h1><p className="mt-2 text-muted-foreground">It may not exist, or you may not have access.</p><Link href="/" className="mt-6 inline-block underline">Return home</Link></div></main>; }

