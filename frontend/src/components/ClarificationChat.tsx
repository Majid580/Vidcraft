import { useState } from 'react'
import { ArrowRight, Bot, Loader2, MessageSquareText, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export function ClarificationChat({
  questions,
  loading,
  onSubmit,
}: {
  questions: string[]
  loading: boolean
  onSubmit: (answers: string[]) => void
}) {
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => ''),
  )

  const answered = answers.filter((a) => a.trim().length > 0).length
  const canSubmit = answered > 0 && !loading

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-primary" />
          A few quick questions
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          The clarification agent needs a little more detail to sharpen your
          scene. Answer what you can — anything left blank is simply skipped.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {questions.map((q, i) => (
          <div key={i} className="flex gap-3">
            <div className="brand-gradient grid size-8 shrink-0 place-items-center rounded-full">
              <Bot className="size-4 text-white" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="surface-1 rounded-2xl rounded-tl-sm border border-border px-4 py-2.5 text-sm">
                {q}
              </div>
              <Textarea
                rows={2}
                placeholder="Your answer…"
                value={answers[i]}
                disabled={loading}
                onChange={(e) => {
                  const next = [...answers]
                  next[i] = e.target.value
                  setAnswers(next)
                }}
                className="min-h-0 text-sm"
              />
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-muted-foreground text-xs">
            {answered} of {questions.length} answered
          </span>
          <Button
            size="lg"
            disabled={!canSubmit}
            onClick={() => onSubmit(answers)}
            className="brand-gradient h-11 gap-2 px-6 font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Refining…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Refine prompt
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
