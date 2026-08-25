import { useState, useEffect } from 'react'
import { getConfig, updateConfig, listProviders, type GatewayConfig, type Provider } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function Settings() {
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {})
    listProviders().then(setProviders).catch(() => {})
  }, [])

  const save = async (updates: Partial<GatewayConfig>) => {
    if (!config) return
    const updated = await updateConfig(updates)
    setConfig(updated)
  }

  if (!config) return null

  const enabledProviders = providers.filter((p) => p.enabled)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Settings</h2>

      <div className="max-w-lg flex flex-col gap-6">
        <div className="border border-border rounded-lg p-5">
          <label className="block text-sm font-medium mb-3">Default Provider</label>
          <select
            value={config.defaultProvider || ''}
            onChange={(e) => save({ defaultProvider: e.target.value || null })}
            className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm outline-none focus:border-primary transition-colors"
          >
            <option value="">None (use fallback chain)</option>
            {enabledProviders.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-2">
            When set, this provider is tried first. If it fails, the fallback chain (sorted by priority) is used.
          </p>
        </div>

        <div className="border border-border rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Free only by default</p>
              <p className="text-xs text-muted-foreground mt-1">
                Requests without an explicit setting will only use free-tier providers. Apps can override this with the freeOnly parameter.
              </p>
            </div>
            <button
              onClick={() => save({ freeOnlyDefault: !config.freeOnlyDefault })}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4',
                config.freeOnlyDefault ? 'bg-success' : 'bg-border',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
                config.freeOnlyDefault && 'translate-x-5',
              )} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
