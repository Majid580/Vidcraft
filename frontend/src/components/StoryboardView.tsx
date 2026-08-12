import {
  Camera,
  CheckCircle2,
  Clapperboard,
  Clock,
  Film,
  ImageIcon,
  Loader2,
  Palette,
  PauseCircle,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { JobStatus, Shot, ShotStatus, StoryboardResponse } from '@/lib/types'

// ADR-020: shots carry the user's explicitly-chosen provider by name (no
// agent decision), so the badge shows exactly which one rendered this shot.
const PROVIDER_BADGE: Record<
  Shot['provider'],
  { label: string; icon: typeof Film; variant: 'violet' | 'cyan' | 'warning' }
> = {
  remotion: { label: 'Remotion', icon: Film, variant: 'violet' },
  pollinations: { label: 'Pollinations', icon: ImageIcon, variant: 'cyan' },
  cloudflare: { label: 'Cloudflare', icon: Sparkles, variant: 'cyan' },
  huggingface: { label: 'Hugging Face', icon: Camera, variant: 'warning' },
}

const STATUS_META: Record<
  ShotStatus,
  { label: string; icon: typeof Film; cls: string; spin?: boolean }
> = {
  pending: { label: 'Queued', icon: Clock, cls: 'text-muted-foreground' },
  processing: { label: 'Generating…', icon: Loader2, cls: 'text-primary', spin: true },
  completed: { label: 'Done', icon: CheckCircle2, cls: 'text-emerald-500' },
  failed: { label: 'Failed', icon: XCircle, cls: 'text-destructive' },
  on_hold: { label: 'On hold', icon: PauseCircle, cls: 'text-amber-500' },
}

function PathwayBadge({ provider }: { provider: Shot['provider'] }) {
  const { label, icon: Icon, variant } = PROVIDER_BADGE[provider]
  return (
    <Badge variant={variant}>
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}

function StatusPill({ status }: { status: ShotStatus }) {
  const { label, icon: Icon, cls, spin } = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className={`size-3.5 ${spin ? 'animate-spin' : ''}`} />
      {label}
    </span>
  )
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0)
    return <span className="text-muted-foreground text-sm">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span
          key={i}
          className="surface-1 rounded-full border border-border px-2.5 py-0.5 text-xs"
        >
          {t}
        </span>
      ))}
    </div>
  )
}

// Real Remotion output is an .mp4; image providers return stills; demo assets
// are SVG data URIs. Detect video by extension so demo (SVG) remotion shots
// still render as an image.
function ShotAsset({ shot }: { shot: Shot }) {
  if (!shot.asset_url) return null
  const isVideo = /\.mp4($|\?)/.test(shot.asset_url)
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-black/20">
      {isVideo ? (
        <video src={shot.asset_url} controls className="block h-auto w-full" />
      ) : (
        <img
          src={shot.asset_url}
          alt={`Shot ${shot.shot_id} render`}
          loading="lazy"
          className="block h-auto w-full"
        />
      )}
    </div>
  )
}

// FR-9: the finished deliverable. Shown above the per-shot grid once the job
// completes, because this — not the individual stills — is what the user came
// for; the shot breakdown below it becomes supporting detail.
function FinalVideo({ job }: { job: JobStatus }) {
  if (job.state !== 'completed') return null

  // Assembly is deliberately non-fatal (the per-shot assets are the expensive
  // part and are already saved), so a failed stitch is reported as its own
  // outcome rather than dragging the whole run down to "failed".
  if (!job.videoUrl) {
    if (!job.videoError) return null
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <XCircle className="size-4 text-amber-500" />
            Shots generated, but the final video couldn&apos;t be assembled
          </span>
          <p className="text-muted-foreground text-xs">{job.videoError}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Film className="size-4 text-primary" />
            Final video
          </h3>
          <a
            href={job.videoUrl}
            download
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
          >
            Download
          </a>
        </div>
        <video
          src={job.videoUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full rounded-lg border"
        />
      </CardContent>
    </Card>
  )
}

function GenerationBar({ job }: { job: JobStatus }) {
  const done = job.state === 'completed'
  const failed = job.state === 'failed'
  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5 py-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            {done ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-500" />
                Generation complete
              </>
            ) : failed ? (
              <>
                <XCircle className="size-4 text-destructive" />
                Generation failed
              </>
            ) : (
              <>
                <Loader2 className="size-4 animate-spin text-primary" />
                Generating assets…
              </>
            )}
          </span>
          <span className="text-muted-foreground tabular-nums">{job.progress}%</span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full transition-all duration-500 ${failed ? 'bg-destructive' : 'brand-gradient'}`}
            style={{ width: `${job.progress}%` }}
          />
        </div>
        {failed && job.failedReason && (
          <p className="text-destructive text-xs">{job.failedReason}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function StoryboardView({
  data,
  job,
}: {
  data: StoryboardResponse
  job?: JobStatus | null
}) {
  const { worldState, shots } = data
  const totalDuration = shots.reduce((s, sh) => s + (sh.duration_s || 0), 0)

  // Overlay live generation results (status/asset_url/error) from the job onto
  // the structural shots from the storyboard.
  const jobById = new Map((job?.shots ?? []).map((s) => [s.shot_id, s]))

  return (
    <div className="flex flex-col gap-5">
      {/* World state */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Clapperboard className="size-4 text-primary" />
              World state
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{shots.length} shots</Badge>
              <Badge variant="outline">
                <Clock className="size-3" />
                {totalDuration}s
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Camera className="size-3.5" /> Setting
              </div>
              <p className="text-sm">{worldState.setting}</p>
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Users className="size-3.5" /> Characters
              </div>
              <Chips items={worldState.characters} />
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Palette className="size-3.5" /> Style
              </div>
              <Chips items={worldState.style_tokens} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generation progress (INTEG-001) */}
      {job && <GenerationBar job={job} />}

      {/* Assembled final video (FR-9 / INTEG-002) */}
      {job && <FinalVideo job={job} />}

      {/* Shot list */}
      <div className="grid gap-4">
        {shots.map((shot) => {
          const live = jobById.get(shot.shot_id)
          const merged: Shot = { ...shot, ...live }
          const status = merged.status ?? 'pending'
          return (
            <Card key={shot.shot_id} className="glow-border hover-lift">
              <CardContent className="flex gap-4">
                <div className="brand-gradient grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white">
                  {shot.shot_id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Shot {shot.shot_id}
                    </span>
                    <PathwayBadge provider={shot.provider} />
                    <Badge variant="outline">
                      <Clock className="size-3" />
                      {shot.duration_s}s
                    </Badge>
                    {job && (
                      <span className="ml-auto">
                        <StatusPill status={status} />
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{shot.description}</p>
                  <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                    <Camera className="size-3.5" />
                    <span className="font-mono">{shot.camera}</span>
                  </div>

                  <ShotAsset shot={merged} />

                  {(status === 'failed' || status === 'on_hold') && merged.error && (
                    <p
                      className={`mt-2 text-xs ${status === 'failed' ? 'text-destructive' : 'text-amber-500'}`}
                    >
                      {merged.error}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
