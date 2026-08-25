import { useState, useEffect } from 'react'
import { getConfig, updateConfig, listProviders, type GatewayConfig, type Provider } from '@/lib/api'

export default function Settings() {
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {})
    listProviders().then(setProviders).catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setSaved(false)
    try {
      const updated = await updateConfig({
        defaultProvider: config.defaultProvider,
        freeOnlyDefault: config.freeOnlyDefault,
      })
      setConfig(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!config) return null

  const enabledProviders = providers.filter((p) => p.enabled)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Settings</h2>

      <div className="max-w-lg flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Default Provider</label>
          <select
            value={config.defaultProvider || ''}
            onChange={(e) => setConfig({ ...config, defaultProvider: e.target.value || null })}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm outline-none focus:border-primary"
          >
            <option value="">None (use fallback chain)</option>
            {enabledProviders.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            When set, this provider is tried first. If it fails, the fallback chain (sorted by priority) is used.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.freeOnlyDefault}
              onChange={(e) => setConfig({ ...config, freeOnlyDefault: e.target.checked })}
              className="w-4 h-4 rounded border-border"
            />
            <div>
              <span className="text-sm font-medium">Free only by default</span>
              <p className="text-xs text-muted-foreground">
                When enabled, requests without an explicit provider will only use free-tier providers. Apps can override this with the X-Free-Only header.
              </p>
            </div>
          </label>
        </div>

        <div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
