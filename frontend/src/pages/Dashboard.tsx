import React, { useState, useEffect } from 'react'
import { listProviders, getHealth, runHealthCheck, type Provider, type HealthStatus } from '@/lib/api'
import { CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProviderIcon from '@/components/ProviderIcon'

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
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Provider</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">Latency</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground w-16">Status</th>
                </tr>
              </thead>
              <tbody>
                {health.providers.map((p, i) => (
                  <React.Fragment key={p.name}>
                    <tr
                      className={cn(
                        !p.error && i < health.providers.length - 1 && 'border-b border-border',
                      )}
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <ProviderIcon name={p.name} size={22} />
                          <span className="font-medium">{p.displayName}</span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', p.isPaid ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
                            {p.isPaid ? 'Paid' : 'Free'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground font-mono">
                        {p.latencyMs !== null ? `${p.latencyMs}ms` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {p.status === 'healthy' ? (
                          <CheckCircle size={16} className="text-success inline-block" />
                        ) : (
                          <XCircle size={16} className="text-destructive inline-block" />
                        )}
                      </td>
                    </tr>
                    {p.error && (
                      <tr className={cn(i < health.providers.length - 1 && 'border-b border-border')}>
                        <td colSpan={3} className="px-4 pb-2.5 pt-0">
                          <div className="text-xs text-destructive bg-destructive/5 rounded px-3 py-2 ml-9">
                            {p.error}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
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
                <div className="flex items-center gap-3">
                  <ProviderIcon name={p.name} size={32} />
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
