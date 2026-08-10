import { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Clapperboard,
  FileText,
  FlaskConical,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
} from 'lucide-react'

import { AppHeader } from '@/components/AppHeader'
import { AuroraBackground } from '@/components/AuroraBackground'
import { Reveal } from '@/components/Reveal'
import { FlowSteps, type Stage } from '@/components/FlowSteps'
import { PromptComposer } from '@/components/PromptComposer'
import { AnalysisPanel } from '@/components/AnalysisPanel'
import { ClarificationChat } from '@/components/ClarificationChat'
import { StoryboardView } from '@/components/StoryboardView'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/hooks/useTheme'
import * as api from '@/lib/api'
import { ApiError } from '@/lib/api'
import type {
  Analysis,
  ClarifyResponse,
  StoryboardResponse,
} from '@/lib/types'

type Busy = null | 'analyze' | 'clarify' | 'generate'

function App() {
  const { theme, toggle } = useTheme()

  const [prompt, setPrompt] = useState('')
  const [promptId, setPromptId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [questions, setQuestions] = useState<string[] | null>(null)
  const [refined, setRefined] = useState<ClarifyResponse | null>(null)
  const [storyboard, setStoryboard] = useState<StoryboardResponse | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [demoMode, setDemoMode] = useState(false)

  const stage: Stage = storyboard
    ? 'storyboard'
    : analysis
      ? 'refine'
      : 'compose'

  const readyToGenerate =
    !!analysis && !storyboard && (questions == null || refined != null)

  function reset() {
    setPrompt('')
    setPromptId(null)
    setAnalysis(null)
    setQuestions(null)
    setRefined(null)
    setStoryboard(null)
    setBusy(null)
    setError(null)
    setOffline(false)
  }

  function handleError(e: unknown) {
    if (e instanceof ApiError && e.offline) {
      setOffline(true)
      setError(
        'The backend (:5000) and ai-service aren’t running, so live generation is unavailable right now.',
      )
    } else {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  async function runAnalyze(text: string, demo: boolean) {
    setBusy('analyze')
    setError(null)
    setOffline(false)
    setPrompt(text)
    try {
      const res = await api.analyzePrompt(text, demo)
      setPromptId(res.promptId)
      setAnalysis(res.analysis)
      setQuestions(res.clarificationQuestions ?? null)
      setRefined(null)
      setStoryboard(null)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(null)
    }
  }

  async function handleClarify(answers: string[]) {
    if (!promptId || !questions) return
    setBusy('clarify')
    setError(null)
    try {
      const res = await api.clarifyPrompt(promptId, questions, answers, demoMode)
      setRefined(res)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(null)
    }
  }

  async function handleGenerate() {
    if (!promptId) return
    setBusy('generate')
    setError(null)
    try {
      const res = await api.generateStoryboard(promptId, demoMode)
      setStoryboard(res)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(null)
    }
  }

  function enterDemoAndRetry() {
    setDemoMode(true)
    void runAnalyze(prompt || 'A lone astronaut drifts past a glowing nebula.', true)
  }

  return (
    <div className="flex min-h-svh flex-col">
      <AuroraBackground />
      <AppHeader theme={theme} onToggleTheme={toggle} demoMode={demoMode} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12">
        {/* Hero — only before analysis */}
        {!analysis && (
          <div className="animate-in-up mb-10 text-center">
            <Badge variant="violet" className="mb-4">
              <Sparkles className="size-3" />
              FR-1 · FR-2 · FR-3 pipeline
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn a sentence into a
              <br />
              <span className="gradient-text-anim">cinematic storyboard</span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base">
              Describe any scene. VidCraft analyzes it, asks smart follow-ups,
              and decomposes it into a shot-by-shot storyboard — powered by a
              multi-agent, retrieval-augmented pipeline.
            </p>
          </div>
        )}

        <div className="mb-8">
          <FlowSteps current={stage} />
        </div>

        {error && (
          <div className="animate-in-up mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 text-sm text-destructive">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
            {offline && !demoMode && (
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                <Button
                  size="sm"
                  onClick={enterDemoAndRetry}
                  className="brand-gradient gap-1.5 text-white hover:opacity-90"
                >
                  <FlaskConical className="size-3.5" />
                  Explore in demo mode
                </Button>
                <span className="text-muted-foreground text-xs">
                  Loads sample data so you can preview the full flow.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-6">
          {/* Compose */}
          {!analysis ? (
            <PromptComposer
              onAnalyze={(t) => runAnalyze(t, demoMode)}
              loading={busy === 'analyze'}
            />
          ) : (
            <Reveal>
              <Card className="hover-glow">
                <CardContent className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
                      <Pencil className="size-3.5" /> Your prompt
                    </div>
                    <p className="truncate text-sm">{prompt}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={reset}
                    className="shrink-0 gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    Start over
                  </Button>
                </CardContent>
              </Card>
            </Reveal>
          )}

          {/* Analysis */}
          {analysis && (
            <Reveal delay={60}>
              <AnalysisPanel analysis={analysis} />
            </Reveal>
          )}

          {/* Refine (clarification) */}
          {analysis && questions && questions.length > 0 && !refined && (
            <Reveal delay={80}>
              <ClarificationChat
                questions={questions}
                loading={busy === 'clarify'}
                onSubmit={handleClarify}
              />
            </Reveal>
          )}

          {/* Refined brief */}
          {refined && (
            <Reveal delay={60}>
              <Card>
                <CardContent className="flex flex-col gap-4">
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <FileText className="size-4 text-primary" />
                    Refined brief
                  </h3>
                  <div className="surface-1 rounded-xl border border-border p-4">
                    {typeof refined.brief === 'string' ? (
                      <p className="text-sm leading-relaxed">{refined.brief}</p>
                    ) : (
                      <dl className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(refined.brief).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-muted-foreground text-xs capitalize">
                              {k.replace(/_/g, ' ')}
                            </dt>
                            <dd className="text-sm leading-relaxed">
                              {String(v)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1.5 text-xs">
                      Clarified prompt
                    </div>
                    <p className="text-foreground/90 text-sm italic leading-relaxed">
                      “{refined.clarifiedPrompt}”
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          )}

          {/* Generate storyboard CTA */}
          {readyToGenerate && (
            <Reveal delay={80}>
              <div className="glow-border brand-shadow hover-glow flex flex-col items-center gap-4 rounded-2xl p-8 text-center">
                <div className="brand-gradient animate-float grid size-12 place-items-center rounded-2xl">
                  <Clapperboard className="size-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Ready to storyboard</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    The Screenwriter and Producer agents will decompose your
                    scene into shots and route each one.
                  </p>
                </div>
                <Button
                  size="lg"
                  disabled={busy === 'generate'}
                  onClick={handleGenerate}
                  className="brand-gradient h-11 gap-2 px-6 font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy === 'generate' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating storyboard…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Generate storyboard
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </Reveal>
          )}

          {/* Storyboard result */}
          {storyboard && (
            <>
              <Reveal>
                <StoryboardView data={storyboard} />
              </Reveal>
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={reset} className="gap-2">
                  <RotateCcw className="size-4" />
                  Create another
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border/60 py-6">
        <p className="text-muted-foreground text-center text-xs">
          VidCraft · Multi-agent, retrieval-augmented video generation ·
          FRONTEND-002
        </p>
      </footer>
    </div>
  )
}

export default App
