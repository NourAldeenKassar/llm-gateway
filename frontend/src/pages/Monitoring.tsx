import { useState, useEffect } from 'react'
import { getMonitoring, type MonitoringData } from '@/lib/api'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProviderIcon from '@/components/ProviderIcon'

export default function Monitoring() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getMonitoring()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (!data && loading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>
  }

  if (!data) return null

  const { overview, providerStats, recentLogs } = data

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Monitoring</h2>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Last minute" value={overview.requestsLastMinute} />
        <StatCard label="Last hour" value={overview.requestsLastHour} />
        <StatCard label="Today" value={overview.requestsToday} />
        <StatCard label="This week" value={overview.requestsThisWeek} />
      </div>

      {(overview.rateLimitsToday > 0 || overview.errorsToday > 0) && (
        <div className="flex gap-4 mb-8">
          {overview.rateLimitsToday > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle size={16} className="text-warning" />
              <span className="text-sm font-medium text-warning">
                {overview.rateLimitsToday} rate limit{overview.rateLimitsToday > 1 ? 's' : ''} today
              </span>
            </div>
          )}
          {overview.errorsToday > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle size={16} className="text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {overview.errorsToday} error{overview.errorsToday > 1 ? 's' : ''} today
              </span>
            </div>
          )}
        </div>
      )}

      {providerStats.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4">Usage by Provider</h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Provider / Model</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Total</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Last min</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Last hour</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Avg latency</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Errors</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Rate limited</th>
                </tr>
              </thead>
              <tbody>
                {providerStats.map((s, i) => (
                  <tr
                    key={`${s.provider}-${s.model}`}
                    className={cn(i < providerStats.length - 1 && 'border-b border-border')}
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-3">
                        <ProviderIcon name={s.provider} size={20} />
                        <div>
                          <span className="font-medium">{s.provider}</span>
                          <span className="text-muted-foreground ml-2 text-xs font-[family-name:var(--font-mono)]">{s.model}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">{s.total}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{s.lastMinute}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{s.lastHour}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">{s.avgLatency}ms</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={cn('font-mono', s.errors > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                        {s.errors}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={cn('font-mono', s.rateLimited > 0 ? 'text-warning' : 'text-muted-foreground')}>
                        {s.rateLimited}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium mb-4">Recent Requests</h3>
        {recentLogs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No requests yet.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Time</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Provider</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Model</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Latency</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Tokens</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={cn(i < recentLogs.length - 1 && 'border-b border-border')}
                  >
                    <td className="py-2.5 px-4 text-muted-foreground text-xs font-mono">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <ProviderIcon name={log.provider} size={16} />
                        <span>{log.provider}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-xs font-[family-name:var(--font-mono)] text-muted-foreground">{log.model}</td>
                    <td className="py-2.5 px-4 text-center">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">{log.latencyMs}ms</td>
                    <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">{log.totalTokens || '-'}</td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{log.source}</td>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold font-mono">{value}</p>
    </div>
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
    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', styles[status] || 'bg-muted text-muted-foreground')}>
      {labels[status] || status}
    </span>
  )
}
