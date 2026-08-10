import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">VidCraft</h1>
      <p className="max-w-md text-muted-foreground">
        Multi-agent, retrieval-augmented pipeline for prompt-driven video
        generation. Frontend scaffold (FRONTEND-001) — Vite, React,
        Tailwind CSS, and shadcn/ui are wired up and ready.
      </p>
      <Button>Get Started</Button>
    </main>
  )
}

export default App
