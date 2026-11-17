import { useState, useEffect, useRef } from 'react'
import {
  getMonitoring,
  type MonitoringData,
  type MonitoringRange,
  type SeriesPoint,
  type ProviderHealthStat,
  type AppStat,
} from '@/lib/api'
import { RefreshCw, ChevronRight, AlertTriangle, Timer, Activity, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProviderIcon from '@/components/ProviderIcon'

// Light and dark steps are defined (and colour-vision validated) as tokens in
// index.css, so the chart follows the theme without re-rendering.
const STATUS = {
  success: { color: 'var(--color-chart-success)', label: 'Success' },
  rateLimited: { color: 'var(--color-chart-warning)', label: 'Rate limited' },
  errors: { color: 'var(--color-chart-error)', label: 'Error' },
} as const

const RANGES: { value: MonitoringRange; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
]

export default function Monitoring() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [range, setRange] = useState<MonitoringRange>('24h')
  const [loading, setLoading] = useState(true)
  const [showLogs, setShowLogs] = useState(false)

  const load = (r: MonitoringRange) => {
    setLoading(true)
    getMonitoring(r).then(setData).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(range) }, [range])

  if (!data && loading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>
  }
  if (!data) return null

  const { kpis, series, providerStats, appStats, recentFailures, recentLogs } = data
  const empty = kpis.requests === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">Monitoring</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={cn(
                  'text-xs px-3 py-1.5 transition-colors',
                  range === r.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(range)}
            disabled={loading}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {empty ? (
        <div className="border border-border rounded-lg p-10 text-center">
          <Activity size={22} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">No requests in this window</p>
          <p className="text-xs text-muted-foreground">
            Try a wider range, or send a request through the gateway.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Kpi
              icon={<Activity size={14} />}
              label="Requests"
              value={kpis.requests.toLocaleString()}
              sub={<Delta current={kpis.requests} previous={kpis.prevRequests} />}
            />
            <SuccessRateKpi rate={kpis.successRate} previous={kpis.prevSuccessRate} />
            <Kpi
              icon={<Timer size={14} />}
              label="p95 latency"
              value={`${kpis.p95Latency.toLocaleString()} ms`}
              sub={<span className="text-muted-foreground">avg {kpis.avgLatency.toLocaleString()} ms</span>}
            />
            <Kpi
              icon={<AlertTriangle size={14} />}
              label="Failures"
              value={kpis.failures.toLocaleString()}
              tone={kpis.failures > 0 ? 'bad' : 'neutral'}
              sub={
                <span className="text-muted-foreground">
                  {kpis.rateLimited} rate limited, {kpis.errors} error{kpis.errors === 1 ? '' : 's'}
                </span>
              }
            />
          </div>

          <Card title="Traffic" className="mb-6" right={<Legend />}>
            <TrafficChart points={series.points} bucketSeconds={series.bucketSeconds} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card title="Provider health" subtitle="Ranked by volume">
              {providerStats.length === 0 ? (
                <Empty>No provider activity.</Empty>
              ) : (
                <div className="divide-y divide-border">
                  {providerStats.map((s) => (
                    <ProviderRow key={`${s.provider}-${s.model}`} stat={s} />
                  ))}
                </div>
              )}
            </Card>

            <Card
              title="Usage by app"
              subtitle={`${kpis.totalTokens.toLocaleString()} tokens total`}
            >
              {appStats.length === 0 ? (
                <Empty>No app activity.</Empty>
              ) : (
                <div className="divide-y divide-border">
                  {appStats.map((a) => (
                    <AppRow
                      key={`${a.app}-${a.tier ?? 'none'}`}
                      stat={a}
                      maxTokens={Math.max(...appStats.map((x) => x.totalTokens), 1)}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {recentFailures.length > 0 && (
            <Card
              title="Recent failures"
              subtitle="What actually went wrong"
              className="mb-6"
            >
              <div className="divide-y divide-border">
                {recentFailures.map((f) => (
                  <div key={f.id} className="py-2.5 flex items-start gap-3">
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{
                        background:
                          f.status === 'rate_limited' ? STATUS.rateLimited.color : STATUS.errors.color,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{f.provider}</span>
                        <code className="text-[11px] text-muted-foreground font-[family-name:var(--font-mono)]">
                          {f.model}
                        </code>
                        <span className="text-[11px] text-muted-foreground">
                          {f.apiKeyName || f.source}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                          {timeAgo(f.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 break-words">
                        {f.error || (f.status === 'rate_limited' ? 'Rate limited' : 'Unknown error')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLogs((v) => !v)}
          className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <ChevronRight
            size={14}
            className={cn('transition-transform text-muted-foreground', showLogs && 'rotate-90')}
          />
          Recent requests
          <span className="text-xs text-muted-foreground font-normal">
            last {recentLogs.length}
          </span>
        </button>
        {showLogs && (
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <Th>Time</Th>
                  <Th>Provider</Th>
                  <Th>Model</Th>
                  <Th center>Status</Th>
                  <Th right>Latency</Th>
                  <Th right>In</Th>
                  <Th right>Out</Th>
                  <Th>App</Th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, i) => (
                  <tr key={log.id} className={cn(i < recentLogs.length - 1 && 'border-b border-border')}>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs font-[family-name:var(--font-mono)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}{' '}
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <ProviderIcon name={log.provider} size={16} />
                        <span>{log.provider}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-xs font-[family-name:var(--font-mono)] text-muted-foreground">
                      {log.model}
                    </td>
                    <td className="py-2.5 px-4 text-center"><StatusBadge status={log.status} /></td>
                    <td className="py-2.5 px-4 text-right font-[family-name:var(--font-mono)] text-muted-foreground">
                      {log.latencyMs}ms
                    </td>
                    <td className="py-2.5 px-4 text-right font-[family-name:var(--font-mono)] text-muted-foreground">
                      {log.promptTokens ?? '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-[family-name:var(--font-mono)] text-muted-foreground">
                      {log.completionTokens ?? '-'}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">
                      {log.apiKeyName || log.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function TrafficChart({ points, bucketSeconds }: { points: SeriesPoint[]; bucketSeconds: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const W = 800
  const H = 200
  const padL = 36
  const padB = 22
  const padT = 8
  const plotW = W - padL
  const plotH = H - padB - padT

  const totals = points.map((p) => p.success + p.rateLimited + p.errors)
  const rawMax = Math.max(...totals, 1)
  const max = niceMax(rawMax)
  const slot = plotW / points.length
  const barW = Math.max(2, Math.min(slot - 4, 28))

  const y = (v: number) => padT + plotH - (v / max) * plotH

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const fracX = (e.clientX - rect.left) / rect.width
    const px = fracX * W
    if (px < padL) return setHover(null)
    const idx = Math.floor((px - padL) / slot)
    setHover(idx >= 0 && idx < points.length ? idx : null)
  }

  const hp = hover !== null ? points[hover] : null

  return (
    <div className="relative" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={padL} x2={W} y1={y(max * f)} y2={y(max * f)}
              stroke="var(--color-border)" strokeWidth="1"
            />
            <text
              x={padL - 8} y={y(max * f) + 3} textAnchor="end"
              className="fill-muted-foreground" style={{ fontSize: 9 }}
            >
              {formatCompact(max * f)}
            </text>
          </g>
        ))}

        {points.map((p, i) => {
          const x = padL + i * slot + (slot - barW) / 2
          const total = p.success + p.rateLimited + p.errors
          if (total === 0) return null
          const segs = [
            { v: p.success, c: STATUS.success.color },
            { v: p.rateLimited, c: STATUS.rateLimited.color },
            { v: p.errors, c: STATUS.errors.color },
          ].filter((s) => s.v > 0)

          let cursor = padT + plotH
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.45}>
              {segs.map((s, si) => {
                const rawH = (s.v / max) * plotH
                const gap = si < segs.length - 1 ? 2 : 0
                const h = Math.max(1, rawH - gap)
                const top = cursor - rawH
                cursor = top
                const isTop = si === segs.length - 1
                return (
                  <path
                    key={si}
                    d={barPath(x, top + gap, barW, h, isTop ? Math.min(4, barW / 2) : 0)}
                    fill={s.c}
                  />
                )
              })}
            </g>
          )
        })}

        <line x1={padL} x2={W} y1={padT + plotH} y2={padT + plotH} stroke="var(--color-border)" strokeWidth="1" />

        {points.map((p, i) =>
          i % Math.ceil(points.length / 5) === 0 ? (
            <text
              key={i}
              x={padL + i * slot + slot / 2}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {formatTick(p.t, bucketSeconds)}
            </text>
          ) : null,
        )}
      </svg>

      {hp && (
        <div
          className="absolute top-0 pointer-events-none bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-xs z-10"
          style={{
            left: `${Math.min(Math.max(((padL + hover! * slot + slot / 2) / W) * 100, 8), 78)}%`,
          }}
        >
          <p className="font-medium mb-1 whitespace-nowrap">{formatFull(hp.t, bucketSeconds)}</p>
          {([
            ['success', hp.success],
            ['rateLimited', hp.rateLimited],
            ['errors', hp.errors],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS[k].color }} />
              <span className="text-muted-foreground">{STATUS[k].label}</span>
              <span className="ml-auto font-[family-name:var(--font-mono)]">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3">
      {(['success', 'rateLimited', 'errors'] as const).map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-2 h-2 rounded-sm" style={{ background: STATUS[k].color }} />
          {STATUS[k].label}
        </span>
      ))}
    </div>
  )
}

function ProviderRow({ stat }: { stat: ProviderHealthStat }) {
  const rate = stat.successRate ?? 0
  const tone = rate >= 99 ? STATUS.success.color : rate >= 90 ? STATUS.rateLimited.color : STATUS.errors.color
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3 mb-2">
        <ProviderIcon name={stat.provider} size={18} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{stat.provider}</span>
          <code className="text-[11px] text-muted-foreground font-[family-name:var(--font-mono)] ml-2">
            {stat.model}
          </code>
        </div>
        <span className="text-sm font-[family-name:var(--font-mono)]" style={{ color: tone }}>
          {stat.successRate === null ? '-' : `${stat.successRate}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
        <div className="h-full rounded-full" style={{ width: `${rate}%`, background: tone }} />
      </div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>{stat.total.toLocaleString()} requests</span>
        <span>p95 {stat.p95Latency.toLocaleString()}ms</span>
        {stat.rateLimited > 0 && (
          <span style={{ color: STATUS.rateLimited.color }}>{stat.rateLimited} rate limited</span>
        )}
        {stat.errors > 0 && <span style={{ color: STATUS.errors.color }}>{stat.errors} errors</span>}
      </div>
    </div>
  )
}

function AppRow({ stat, maxTokens }: { stat: AppStat; maxTokens: number }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium truncate">{stat.app}</span>
        {stat.tier && <TierBadge tier={stat.tier} />}
        <span className="ml-auto text-sm font-[family-name:var(--font-mono)] shrink-0">
          {stat.totalTokens.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max((stat.totalTokens / maxTokens) * 100, 2)}%` }}
        />
      </div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>{stat.requests.toLocaleString()} requests</span>
        <span>{stat.promptTokens.toLocaleString()} in / {stat.completionTokens.toLocaleString()} out</span>
        {stat.failures > 0 && (
          <span style={{ color: STATUS.errors.color }}>{stat.failures} failed</span>
        )}
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    free: 'bg-success/10 text-success',
    paid: 'bg-warning/10 text-warning',
    any: 'bg-primary/10 text-primary',
  }
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded capitalize shrink-0', styles[tier] || 'bg-muted text-muted-foreground')}>
      {tier}
    </span>
  )
}

function Kpi({
  icon, label, value, sub, tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: React.ReactNode
  tone?: 'neutral' | 'bad'
}) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
        {icon}
        <p className="text-xs">{label}</p>
      </div>
      <p
        className="text-2xl font-semibold font-[family-name:var(--font-mono)] tracking-tight"
        style={tone === 'bad' ? { color: STATUS.errors.color } : undefined}
      >
        {value}
      </p>
      <div className="text-[11px] mt-1">{sub}</div>
    </div>
  )
}

function SuccessRateKpi({ rate, previous }: { rate: number | null; previous: number | null }) {
  const r = rate ?? 0
  const tone = r >= 99 ? STATUS.success.color : r >= 90 ? STATUS.rateLimited.color : STATUS.errors.color
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
        <CheckCircle2 size={14} />
        <p className="text-xs">Success rate</p>
      </div>
      <p className="text-2xl font-semibold font-[family-name:var(--font-mono)] tracking-tight" style={{ color: tone }}>
        {rate === null ? '-' : `${rate}%`}
      </p>
      <div className="h-1 rounded-full bg-muted overflow-hidden mt-2 mb-1">
        <div className="h-full rounded-full" style={{ width: `${r}%`, background: tone }} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {previous === null ? 'no prior data' : `was ${previous}%`}
      </p>
    </div>
  )
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <span className="text-muted-foreground">no prior data</span>
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  const arrow = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  return (
    <span className="text-muted-foreground">
      {arrow === 'up' ? '▲' : arrow === 'down' ? '▼' : '–'} {Math.abs(pct)}% vs previous
    </span>
  )
}

function Card({
  title, subtitle, right, children, className,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('border border-border rounded-lg p-5', className)}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-sm font-medium">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground py-4">{children}</p>
}

function Th({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <th
      className={cn(
        'py-2.5 px-4 font-medium text-muted-foreground text-xs whitespace-nowrap',
        right ? 'text-right' : center ? 'text-center' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-success/10 text-success',
    error: 'bg-destructive/10 text-destructive',
    rate_limited: 'bg-warning/10 text-warning',
  }
  const labels: Record<string, string> = {
    success: 'OK',
    error: 'Error',
    rate_limited: 'Rate limited',
  }
  return (
    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap', styles[status] || 'bg-muted text-muted-foreground')}>
      {labels[status] || status}
    </span>
  )
}

function barPath(x: number, y: number, w: number, h: number, r: number) {
  if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`
  const rr = Math.min(r, h)
  return `M${x},${y + rr}a${rr},${rr} 0 0 1 ${rr},${-rr}h${w - rr * 2}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - rr}h${-w}Z`
}

function niceMax(v: number) {
  if (v <= 5) return 5
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  return Math.ceil(v / mag) * mag
}

function formatCompact(v: number) {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`
  return String(Math.round(v))
}

function formatTick(iso: string, bucketSeconds: number) {
  const d = new Date(iso)
  if (bucketSeconds >= 6 * 3600) {
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatFull(iso: string, bucketSeconds: number) {
  const d = new Date(iso)
  if (bucketSeconds >= 6 * 3600) {
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
  }
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
