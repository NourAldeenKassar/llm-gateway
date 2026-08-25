import { useState, useEffect } from 'react'
import { listProviders, getHealth, runHealthCheck, type Provider, type HealthStatus } from '@/lib/api'
import { CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    listProviders().then(setProviders).catch(() => {})
    getHealth().then(setHealth).catch(() => {})
  }, [])

  const handleRunCheck = async () => {
    setChecking(true)
    try {
      const result = await runHealthCheck()
      setHealth(result)
    } catch {
      // ignore
    } finally {
      setChecking(false)
    }
  }

  const enabledCount = providers.filter((p) => p.enabled).length
  const freeCount = providers.filter((p) => p.enabled && !p.isPaid).length
  const paidCount = providers.filter((p) => p.enabled && p.isPaid).length

  const statusLabel = health?.status === 'healthy'
    ? 'Healthy'
    : health?.status === 'degraded'
      ? 'Degraded'
      : health?.status === 'unhealthy'
        ? 'Unhealthy'
        : 'Unchecked'

  const statusColor = health?.status === 'healthy'
    ? 'success'
    : health?.status === 'degraded'
      ? 'warning'
      : health?.status === 'unhealthy'
        ? 'destructive'
        : 'muted-foreground'

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-muted-foreground">System</p>
            <button
              onClick={handleRunCheck}
              disabled={checking}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Run health check on all providers"
            >
              <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking...' : 'Check'}
            </button>
          </div>
          <p className={cn('text-lg font-semibold', `text-${statusColor}`)}>{statusLabel}</p>
          {health?.lastCheck && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock size={10} />
              {new Date(health.lastCheck).toLocaleTimeString()}
            </p>
          )}
        </div>
        <StatCard label="Active Providers" value={String(enabledCount)} color="primary" />
        <StatCard label="Free / Paid" value={`${freeCount} / ${paidCount}`} color="primary" />
      </div>

      {health && health.providers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4">Provider Health</h3>
          <div className="flex flex-col gap-2">
            {health.providers.map((p) => (
              <div
                key={p.name}
                className={cn(
                  'flex items-center justify-between border rounded-lg px-4 py-3',
                  p.status === 'healthy' ? 'border-success/30' : 'border-destructive/30',
                )}
              >
                <div className="flex items-center gap-3">
                  {p.status === 'healthy' ? (
                    <CheckCircle size={16} className="text-success" />
                  ) : (
                    <XCircle size={16} className="text-destructive" />
                  )}
                  <span className="text-sm font-medium">{p.displayName}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {p.latencyMs !== null && (
                    <span>{p.latencyMs}ms</span>
                  )}
                  {p.error && (
                    <span className="text-destructive text-xs max-w-xs truncate" title={p.error}>
                      {p.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-lg font-medium mb-4">Providers</h3>

      {providers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No providers configured. Add one in the Providers page.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((p) => (
            <div
              key={p.id}
              className={cn(
                'border rounded-lg p-4 transition-colors',
                p.enabled ? 'border-border' : 'border-border/50 opacity-50',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.displayName}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', p.isPaid ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
                    {p.isPaid ? 'Paid' : 'Free'}
                  </span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Model: {p.defaultModel}</p>
                <p>Type: {p.type}</p>
                <p>Priority: {p.priority}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    success: 'text-success',
    warning: 'text-warning',
    primary: 'text-primary',
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-lg font-semibold', colorMap[color] || 'text-foreground')}>{value}</p>
    </div>
  )
}
