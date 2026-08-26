import { useState, useEffect } from 'react'
import { getConfig, updateConfig, listProviders, changePassword, type GatewayConfig, type Provider } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function Settings() {
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {})
    listProviders().then(setProviders).catch(() => {})
  }, [])

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
