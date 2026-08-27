import { useState, useEffect } from 'react'
import {
  getConfig, updateConfig, listProviders, changePassword,
  listApiKeys, createApiKey, updateApiKey, deleteApiKey,
  type GatewayConfig, type Provider, type ApiKey,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Copy, Check } from 'lucide-react'

export default function Settings() {
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyExpiry, setNewKeyExpiry] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {})
    listProviders().then(setProviders).catch(() => {})
    loadApiKeys()
  }, [])

  const loadApiKeys = () => listApiKeys().then(setApiKeys).catch(() => {})

  const save = async (updates: Partial<GatewayConfig>) => {
    if (!config) return
    const updated = await updateConfig(updates)
    setConfig(updated)
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch {
      setPasswordError('Current password is incorrect')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return
    const key = await createApiKey(newKeyName.trim(), newKeyExpiry || undefined)
    setCreatedKey(key.key)
    setNewKeyName('')
    setNewKeyExpiry('')
    loadApiKeys()
  }

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleToggleKey = async (id: string, enabled: boolean) => {
    await updateApiKey(id, { enabled: !enabled })
    loadApiKeys()
  }

  const handleDeleteKey = async (id: string) => {
    await deleteApiKey(id)
    loadApiKeys()
  }

  if (!config) return null

  const enabledProviders = providers.filter((p) => p.enabled)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Settings</h2>

      <div className="max-w-2xl flex flex-col gap-6">
        <div className="border border-border rounded-lg p-5">
          <p className="text-sm font-medium mb-4">API Keys</p>

          {createdKey && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-xs text-success font-medium mb-2">Key created — copy it now, it won't be shown again</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-[family-name:var(--font-mono)] bg-background px-3 py-2 rounded border border-border break-all">
                  {createdKey}
                </code>
                <button
                  onClick={handleCopyKey}
                  className="shrink-0 p-2 rounded-md border border-border hover:bg-muted transition-colors"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="App name (e.g. category-game)"
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm outline-none focus:border-primary transition-colors"
            />
            <input
              type="datetime-local"
              value={newKeyExpiry}
              onChange={(e) => setNewKeyExpiry(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={handleCreateKey}
              disabled={!newKeyName.trim()}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              <Plus size={14} />
              Create
            </button>
          </div>

          {apiKeys.length > 0 && (
            <div className="space-y-2">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{k.name}</span>
                      <code className="text-xs text-muted-foreground font-[family-name:var(--font-mono)]">{k.key}</code>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {k.expiresAt
                        ? `Expires: ${new Date(k.expiresAt).toLocaleDateString()} ${new Date(k.expiresAt).toLocaleTimeString()}`
                        : 'No expiry'}
                      {k.expiresAt && new Date(k.expiresAt) < new Date() && (
                        <span className="text-destructive ml-2">Expired</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleKey(k.id, k.enabled)}
                    className={cn(
                      'text-xs px-3 py-1 rounded-md border transition-colors shrink-0',
                      k.enabled
                        ? 'border-success/30 text-success hover:bg-success/10'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {k.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDeleteKey(k.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {apiKeys.length === 0 && !createdKey && (
            <p className="text-xs text-muted-foreground">No API keys yet. Create one for each app that uses the gateway.</p>
          )}
        </div>

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

        <div className="border border-border rounded-lg p-5">
          <p className="text-sm font-medium mb-4">Change Password</p>
          <div className="flex flex-col gap-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm outline-none focus:border-primary transition-colors"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm outline-none focus:border-primary transition-colors"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm outline-none focus:border-primary transition-colors"
            />
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-success">Password changed successfully</p>
            )}
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
