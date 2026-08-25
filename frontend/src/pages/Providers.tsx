import { useState, useEffect } from 'react'
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  type Provider,
  type TestResult,
} from '@/lib/api'
import { Plus, Trash2, FlaskConical, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const PROVIDER_PRESETS = [
  { name: 'groq', displayName: 'Groq', type: 'openai-compat', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'openai/gpt-oss-120b', isPaid: false },
  { name: 'gemini', displayName: 'Google Gemini', type: 'gemini', baseUrl: null, defaultModel: 'gemini-3.6-flash', isPaid: false },
  { name: 'mistral', displayName: 'Mistral', type: 'openai-compat', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', isPaid: false },
  { name: 'openai', displayName: 'OpenAI', type: 'openai-compat', baseUrl: null, defaultModel: 'gpt-4o-mini', isPaid: true },
]

export default function Providers() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})

  const load = () => listProviders().then(setProviders).catch(() => {})

  useEffect(() => { load() }, [])

  const handleAdd = async (preset: typeof PROVIDER_PRESETS[0], apiKey: string) => {
    await createProvider({
      ...preset,
      apiKey,
      baseUrl: preset.baseUrl,
      enabled: true,
      priority: providers.length,
    })
    setShowAdd(false)
    load()
  }

  const handleToggle = async (p: Provider) => {
    await updateProvider(p.id, { enabled: !p.enabled })
    load()
  }

  const handleDelete = async (id: string) => {
    await deleteProvider(id)
    load()
  }

  const handleTest = async (id: string) => {
    setTesting((prev) => ({ ...prev, [id]: true }))
    try {
      const result = await testProvider(id)
      setTestResults((prev) => ({ ...prev, [id]: result }))
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, error: 'Request failed' } }))
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }))
    }
  }

  const existingNames = providers.map((p) => p.name)
  const availablePresets = PROVIDER_PRESETS.filter((p) => !existingNames.includes(p.name))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Providers</h2>
        {availablePresets.length > 0 && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {showAdd ? <X size={16} /> : <Plus size={16} />}
            {showAdd ? 'Cancel' : 'Add Provider'}
          </button>
        )}
      </div>

      {showAdd && <AddProviderPanel presets={availablePresets} onAdd={handleAdd} />}

      <div className="flex flex-col gap-4">
        {providers.map((p) => (
          <div key={p.id} className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-medium">{p.displayName}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full', p.isPaid ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
                  {p.isPaid ? 'Paid' : 'Free'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(p)}
                  className={cn(
                    'text-xs px-3 py-1 rounded-md border transition-colors',
                    p.enabled
                      ? 'border-success/30 text-success hover:bg-success/10'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {p.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => handleTest(p.id)}
                  disabled={testing[p.id]}
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <FlaskConical size={12} />
                  {testing[p.id] ? 'Testing...' : 'Test'}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs px-2 py-1 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>Model: {p.defaultModel}</div>
              <div>Type: {p.type}</div>
              <div>Priority: {p.priority}</div>
              <div>Key: {p.apiKey}</div>
            </div>

            {testResults[p.id] && (
              <div className={cn('mt-3 text-sm p-2 rounded-md', testResults[p.id].success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                {testResults[p.id].success
                  ? `OK — responded: "${testResults[p.id].response}"`
                  : `Failed — ${testResults[p.id].error}`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AddProviderPanel({ presets, onAdd }: { presets: typeof PROVIDER_PRESETS; onAdd: (preset: typeof PROVIDER_PRESETS[0], apiKey: string) => void }) {
  const [selected, setSelected] = useState<typeof PROVIDER_PRESETS[0] | null>(null)
  const [apiKey, setApiKey] = useState('')

  return (
    <div className="border border-border rounded-lg p-4 mb-6">
      <p className="text-sm font-medium mb-3">Select a provider</p>
      <div className="flex gap-2 mb-4">
        {presets.map((p) => (
          <button
            key={p.name}
            onClick={() => { setSelected(p); setApiKey('') }}
            className={cn(
              'px-3 py-2 rounded-md text-sm border transition-colors',
              selected?.name === p.name
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {p.displayName}
          </button>
        ))}
      </div>

      {selected && (
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`${selected.displayName} API key`}
            className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => onAdd(selected, apiKey)}
            disabled={!apiKey}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
