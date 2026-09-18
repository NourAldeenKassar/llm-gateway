import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  listProviders,
  listModels,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  reorderProviders,
  type Provider,
  type TestResult,
} from '@/lib/api'
import { Plus, Trash2, FlaskConical, X, Pencil, Check, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

const PROVIDER_PRESETS = [
  { name: 'groq', displayName: 'Groq', type: 'openai-compat', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'openai/gpt-oss-120b', isPaid: false },
  { name: 'gemini', displayName: 'Google Gemini', type: 'gemini', baseUrl: null, defaultModel: 'gemini-3.8-flash', isPaid: false },
  { name: 'mistral', displayName: 'Mistral', type: 'openai-compat', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', isPaid: false },
  { name: 'openai', displayName: 'OpenAI', type: 'openai-compat', baseUrl: null, defaultModel: 'gpt-4o-mini', isPaid: true },
  { name: 'grok', displayName: 'Grok (xAI)', type: 'openai-compat', baseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-3-mini-fast', isPaid: true },
]

function SortableProvider({
  p,
  editing,
  editValues,
  editModels,
  loadingModels,
  testing,
  testResults,
  onToggle,
  onTogglePaid,
  onEdit,
  onSaveEdit,
  onDelete,
  onTest,
  onEditChange,
}: {
  p: Provider
  editing: string | null
  editValues: Partial<Provider>
  editModels: string[]
  loadingModels: boolean
  testing: Record<string, boolean>
  testResults: Record<string, TestResult>
  onToggle: (p: Provider) => void
  onTogglePaid: (p: Provider) => void
  onEdit: (p: Provider) => void
  onSaveEdit: (id: string) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onEditChange: (values: Partial<Provider>) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: p.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
          >
            <GripVertical size={16} />
          </button>
          <span className="font-medium">{p.displayName}</span>
          <button
            onClick={() => onTogglePaid(p)}
            className={cn('text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-70 transition-opacity', p.isPaid ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}
            title="Click to toggle free/paid"
          >
            {p.isPaid ? 'Paid' : 'Free'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(p)}
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
            onClick={() => onTest(p.id)}
            disabled={testing[p.id]}
            className="flex items-center gap-1 text-xs px-3 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <FlaskConical size={12} />
            {testing[p.id] ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={() => editing === p.id ? onSaveEdit(p.id) : onEdit(p)}
            className="flex items-center gap-1 text-xs px-3 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            {editing === p.id ? <Check size={12} /> : <Pencil size={12} />}
            {editing === p.id ? 'Save' : 'Edit'}
          </button>
          <button
            onClick={() => onDelete(p.id)}
            className="text-xs px-2 py-1 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing === p.id ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
            <input
              value={editValues.displayName || ''}
              onChange={(e) => onEditChange({ ...editValues, displayName: e.target.value })}
              className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Default Model</label>
            <select
              value={editValues.defaultModel || ''}
              onChange={(e) => onEditChange({ ...editValues, defaultModel: e.target.value })}
              disabled={loadingModels}
              className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:border-primary disabled:opacity-50"
            >
              {loadingModels ? (
                <option>Loading...</option>
              ) : (
                editModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">New API Key (leave empty to keep)</label>
            <input
              type="password"
              value={editValues.apiKey || ''}
              onChange={(e) => onEditChange({ ...editValues, apiKey: e.target.value })}
              placeholder="unchanged"
              className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>Model: {p.defaultModel}</div>
          <div>Type: {p.type}</div>
          <div>Priority: {p.priority}</div>
          <div>Key: {p.apiKey}</div>
        </div>
      )}

      {testResults[p.id] && (
        <div className={cn('mt-3 text-sm p-2 rounded-md', testResults[p.id].success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
          {testResults[p.id].success
            ? `OK: "${testResults[p.id].response}"`
            : `Failed: ${testResults[p.id].error}`}
        </div>
      )}
    </div>
  )
}

export default function Providers() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Provider>>({})
  const [editModels, setEditModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = () => listProviders().then(setProviders).catch(() => {})

  useEffect(() => { load() }, [])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = providers.findIndex((p) => p.id === active.id)
    const newIndex = providers.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(providers, oldIndex, newIndex)

    setProviders(reordered.map((p, i) => ({ ...p, priority: i })))
    await reorderProviders(reordered.map((p) => p.id))
    load()
  }

  const handleAdd = async (preset: typeof PROVIDER_PRESETS[0], apiKey: string, isPaid: boolean) => {
    const baseName = preset.name
    const existing = providers.filter((p) => p.name === baseName || p.name.startsWith(baseName + '-'))
    const name = existing.length === 0 ? baseName : `${baseName}-${existing.length + 1}`
    const displayName = existing.length === 0 ? preset.displayName : `${preset.displayName} ${existing.length + 1}`

    await createProvider({
      ...preset,
      name,
      displayName,
      apiKey,
      isPaid,
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

  const handleTogglePaid = async (p: Provider) => {
    await updateProvider(p.id, { isPaid: !p.isPaid })
    load()
  }

  const handleEdit = (p: Provider) => {
    setEditing(p.id)
    setEditValues({
      displayName: p.displayName,
      defaultModel: p.defaultModel,
      apiKey: '',
    })
    setLoadingModels(true)
    listModels(p.id)
      .then(setEditModels)
      .catch(() => setEditModels([p.defaultModel]))
      .finally(() => setLoadingModels(false))
  }

  const handleSaveEdit = async (id: string) => {
    const updates: Partial<Provider> = {}
    if (editValues.displayName) updates.displayName = editValues.displayName
    if (editValues.defaultModel) updates.defaultModel = editValues.defaultModel
    if (editValues.apiKey) updates.apiKey = editValues.apiKey

    await updateProvider(id, updates)
    setEditing(null)
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Providers</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showAdd ? <X size={16} /> : <Plus size={16} />}
          {showAdd ? 'Cancel' : 'Add Provider'}
        </button>
      </div>

      {showAdd && <AddProviderPanel presets={PROVIDER_PRESETS} onAdd={handleAdd} />}

      <p className="text-xs text-muted-foreground mb-3">Drag to reorder priority. Top provider is tried first.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={providers.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
            {providers.map((p) => (
              <SortableProvider
                key={p.id}
                p={p}
                editing={editing}
                editValues={editValues}
                editModels={editModels}
                loadingModels={loadingModels}
                testing={testing}
                testResults={testResults}
                onToggle={handleToggle}
                onTogglePaid={handleTogglePaid}
                onEdit={handleEdit}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
                onTest={handleTest}
                onEditChange={setEditValues}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function AddProviderPanel({ presets, onAdd }: { presets: typeof PROVIDER_PRESETS; onAdd: (preset: typeof PROVIDER_PRESETS[0], apiKey: string, isPaid: boolean) => void }) {
  const [selected, setSelected] = useState<typeof PROVIDER_PRESETS[0] | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [isPaid, setIsPaid] = useState(false)

  return (
    <div className="border border-border rounded-lg p-4 mb-6">
      <p className="text-sm font-medium mb-3">Select a provider</p>
      <div className="flex gap-2 mb-4">
        {presets.map((p) => (
          <button
            key={p.name}
            onClick={() => { setSelected(p); setApiKey(''); setIsPaid(p.isPaid) }}
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
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`${selected.displayName} API key`}
              className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => onAdd(selected, apiKey, isPaid)}
              disabled={!apiKey}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Add
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn('text-sm', !isPaid ? 'text-success font-medium' : 'text-muted-foreground')}>Free</span>
            <button
              type="button"
              onClick={() => setIsPaid(!isPaid)}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                isPaid ? 'bg-warning' : 'bg-success',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                isPaid && 'translate-x-5',
              )} />
            </button>
            <span className={cn('text-sm', isPaid ? 'text-warning font-medium' : 'text-muted-foreground')}>Paid</span>
          </div>
        </div>
      )}
    </div>
  )
}
