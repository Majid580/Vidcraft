import { Check, Loader2, Minus, TriangleAlert, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { JobStatus, Shot, StoryboardResponse } from '@/lib/types'

// The pipeline, made visible.
//
// Generating a storyboard takes a couple of minutes, and until now that time
// was represented by a single percentage. Everything interesting about this
// project happens inside it: four agents run in sequence, the camera work is
// grounded in a retrieval corpus, the storyboard is checked back against the
// prompt, every shot is critiqued by a vision model and re-generated if it
// fails, and the results are assembled into a film. This component is that
// process, shown as it happens.
//
// It reports only what the API actually tells us. The orchestrator does not
// stream per-agent progress, so while it is running the three agent stages
// are shown as a group that is running — not as a fake sequential fill, which
// would be inventing detail we do not have.

type StageState = 'pending' | 'active' | 'done' | 'warn' | 'fail'

const MARKER: Record<StageState, { cls: string; icon: typeof Check | null }> = {
  pending: { cls: 'border-border text-muted-foreground/50', icon: Minus },
  active: {
    cls: 'border-primary/70 bg-primary/15 text-primary pulse-active',
    icon: Loader2,
  },
  done: { cls: 'border-accent/60 bg-accent/15 text-accent', icon: Check },
  warn: { cls: 'border-warning/60 bg-warning/15 text-warning', icon: TriangleAlert },
  fail: { cls: 'border-destructive/60 bg-destructive/15 text-destructive', icon: X },
}

function Stage({
  index,
  label,
  detail,
  state,
  last,
  children,
}: {
  index: number
  label: string
  detail?: string
  state: StageState
  last?: boolean
  children?: React.ReactNode
}) {
  const { cls, icon: Icon } = MARKER[state]
  return (
    <li className="relative flex gap-3.5">
      {/* Rail: the connector between markers. While a stage is active a
          highlight runs down it, like film advancing through a gate. */}
      {!last && (
        <span
          aria-hidden
          className="bg-border absolute top-7 bottom-0 left-[13px] w-px overflow-hidden"
        >
          {state === 'active' && (
            <span className="bg-primary rail-fill absolute inset-0 block" />
          )}
        </span>
      )}

      <span
        className={cn(
          'grid size-[27px] shrink-0 place-items-center rounded-[5px] border transition-colors duration-300',
          cls,
        )}
      >
        {Icon && (
          <Icon
            className={cn('size-3.5', state === 'active' && 'animate-spin')}
            strokeWidth={2.4}
          />
        )}
      </span>

      <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-5')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span
            className={cn(
              'font-display text-[15px] leading-tight font-semibold tracking-tight',
              state === 'pending' && 'text-muted-foreground',
            )}
          >
            <span className="data text-muted-foreground mr-2 text-[11px] font-normal">
              {String(index).padStart(2, '0')}
            </span>
            {label}
          </span>
          {detail && (
            <span className="data text-muted-foreground text-[11px]">{detail}</span>
          )}
        </div>
        {children}
      </div>
    </li>
  )
}

// One square per shot, coloured by outcome — a strip of frames you can read
// at a glance. The critic's verdict rides on the same square: a shot that
// passed generation but failed critique is not the same as one that failed.
function ShotTicks({ shots }: { shots: Shot[] }) {
  if (shots.length === 0) return null
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {shots.map((s) => {
        const cls =
          s.status === 'completed'
            ? s.critic_passed === false
              ? 'border-warning/50 bg-warning/20 text-warning'
              : 'border-accent/50 bg-accent/20 text-accent'
            : s.status === 'processing'
              ? 'border-primary/60 bg-primary/20 text-primary pulse-active'
              : s.status === 'failed'
                ? 'border-destructive/50 bg-destructive/20 text-destructive'
                : s.status === 'on_hold'
                  ? 'border-warning/50 bg-warning/15 text-warning'
                  : 'border-border text-muted-foreground/60'
        const note =
          s.status === 'completed' && s.critic_passed === false
            ? ` · critic: ${s.critic_reason ?? 'not matched'}${s.retry_count ? ` (after ${s.retry_count} retries)` : ''}`
            : s.error
              ? ` · ${s.error}`
              : ''
        return (
          <span
            key={s.shot_id}
            title={`Shot ${s.shot_id} — ${s.status}${note}`}
            className={cn(
              'data grid h-6 min-w-6 place-items-center rounded-[4px] border px-1.5 text-[10px] transition-colors duration-300',
              cls,
            )}
          >
            {s.shot_id}
          </span>
        )
      })}
    </div>
  )
}

export function PipelineRail({
  composing,
  storyboard,
  job,
}: {
  /** true while POST /api/storyboards is in flight (the LangGraph run) */
  composing: boolean
  storyboard: StoryboardResponse | null
  job: JobStatus | null
}) {
  if (!composing && !storyboard && !job) return null

  const shots = job?.shots?.length ? job.shots : (storyboard?.shots ?? [])
  const hasStoryboard = !!storyboard

  // Stages 1-3 are the LangGraph orchestrator. It returns one result for the
  // whole graph, so they resolve together rather than one at a time.
  const agentState: StageState = hasStoryboard
    ? 'done'
    : composing
      ? 'active'
      : 'pending'

  const rendered = shots.filter((s) => s.status === 'completed').length
  const failedShots = shots.filter((s) => s.status === 'failed').length
  const heldShots = shots.filter((s) => s.status === 'on_hold').length
  const renderDone = !!job && (job.state === 'completed' || job.state === 'failed')

  const renderState: StageState = !job
    ? 'pending'
    : renderDone
      ? failedShots || heldShots
        ? 'warn'
        : 'done'
      : 'active'

  const assembleState: StageState = !renderDone
    ? 'pending'
    : job?.videoUrl
      ? 'done'
      : job?.videoError
        ? 'fail'
        : 'pending'

  const styleTokens = storyboard?.worldState?.style_tokens?.length ?? 0
  const totalSeconds = shots.reduce((a, s) => a + (s.duration_s || 0), 0)

  const extras = [
    job?.thumbnailUrl && 'poster',
    job?.subtitlesUrl && 'captions',
    job?.subtitledVideoUrl && 'subtitled copy',
  ].filter(Boolean) as string[]

  return (
    <section
      aria-label="Pipeline progress"
      className="plate plate-ruled rounded-xl px-5 py-5 sm:px-6"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="slate-label">Pipeline</h2>
        {job && !renderDone && (
          <span className="data text-muted-foreground text-[11px]">
            {job.progress}%
          </span>
        )}
      </div>

      <ol>
        <Stage
          index={1}
          label="Screenwriter"
          state={agentState}
          detail={hasStoryboard ? `${shots.length} shots · ${totalSeconds}s` : undefined}
        >
          <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
            Decomposes the brief into a shot list with framing and durations.
          </p>
        </Stage>

        <Stage
          index={2}
          label="Cinematographer"
          state={agentState}
          detail={hasStoryboard && styleTokens ? `${styleTokens} style tokens` : undefined}
        >
          <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
            Grounds each shot's camera and look in a retrieval corpus of real
            cinematography technique.
          </p>
        </Stage>

        <Stage
          index={3}
          label="Intent check"
          state={agentState}
          detail={hasStoryboard ? 'verified' : undefined}
        >
          <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
            Compares the storyboard back against the prompt and sends it back
            for a rewrite if it has drifted.
          </p>
        </Stage>

        <Stage
          index={4}
          label="Render"
          state={renderState}
          detail={shots.length ? `${rendered}/${shots.length} shots` : undefined}
        >
          <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
            Each shot is generated, then critiqued by a vision model and
            re-generated if it doesn&apos;t match its description.
          </p>
          <ShotTicks shots={shots} />
          {(failedShots > 0 || heldShots > 0) && renderDone && (
            <p className="text-warning mt-2 text-[12px]">
              {failedShots > 0 && `${failedShots} shot${failedShots > 1 ? 's' : ''} failed`}
              {failedShots > 0 && heldShots > 0 && ', '}
              {heldShots > 0 && `${heldShots} on hold`}
              {' — the film is assembled from the shots that succeeded.'}
            </p>
          )}
        </Stage>

        <Stage
          index={5}
          label="Assemble"
          state={assembleState}
          last
          detail={extras.length ? extras.join(' · ') : undefined}
        >
          <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
            Cuts the shots into one continuous film, then adds the poster frame
            and captions.
          </p>
          {job?.videoError && (
            <p className="text-destructive mt-2 text-[12px]">{job.videoError}</p>
          )}
        </Stage>
      </ol>
    </section>
  )
}
