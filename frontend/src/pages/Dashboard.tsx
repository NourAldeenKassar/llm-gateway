import { useState, useEffect } from 'react'
import { listProviders, getHealth, type Provider } from '@/lib/api'
import { CheckCircle, XCircle, Zap, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [health, setHealth] = useState<{ status: string; checks: Record<string, string> } | null>(null)

  useEffect(() => {
    listProviders().then(setProviders).catch(() => {})
    getHealth().then(setHealth).catch(() => {})
  }, [])

  const enabledCount = providers.filter((p) => p.enabled).length
  const freeCount = providers.filter((p) => p.enabled && !p.isPaid).length
  const paidCount = providers.filter((p) => p.enabled && p.isPaid).length

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="System" value={health?.status === 'ok' ? 'Healthy' : 'Degraded'} color={health?.status === 'ok' ? 'success' : 'warning'} />
        <StatCard label="Active Providers" value={String(enabledCount)} color="primary" />
        <StatCard label="Free / Paid" value={`${freeCount} / ${paidCount}`} color="primary" />
      </div>

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
                  {p.isPaid ? (
                    <DollarSign size={14} className="text-warning" />
                  ) : (
                    <Zap size={14} className="text-success" />
                  )}
                </div>
                {p.enabled ? (
                  <CheckCircle size={16} className="text-success" />
                ) : (
                  <XCircle size={16} className="text-muted-foreground" />
                )}
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
