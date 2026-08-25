import { useState, useRef, useEffect } from 'react'
import { listProviders, listModels, type Provider } from '@/lib/api'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import axios from 'axios'

interface Message {
  role: 'user' | 'assistant'
  content: string
  provider?: string
  model?: string
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [freeOnly, setFreeOnly] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listProviders().then((p) => setProviders(p.filter((x) => x.enabled))).catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!selectedProvider) {
      setModels([])
      setSelectedModel('')
      return
    }

    const provider = providers.find((p) => p.name === selectedProvider)
    if (!provider) return

    setLoadingModels(true)
    setSelectedModel('')
    listModels(provider.id)
      .then((m) => {
        setModels(m)
        if (m.includes(provider.defaultModel)) {
          setSelectedModel(provider.defaultModel)
        }
      })
      .catch(() => {
        setModels([provider.defaultModel])
        setSelectedModel(provider.defaultModel)
      })
      .finally(() => setLoadingModels(false))
  }, [selectedProvider, providers])

  const send = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const { data } = await axios.post(
        '/api/admin/chat',
        {
          prompt: input.trim(),
          provider: selectedProvider || undefined,
          model: selectedModel || undefined,
          freeOnly: selectedProvider ? undefined : freeOnly,
        },
        { withCredentials: true },
      )

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.text, provider: data.provider, model: data.model },
      ])
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Request failed'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Chat</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:border-primary"
          >
            <option value="">Auto (fallback)</option>
            {providers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
              </option>
            ))}
          </select>
          {selectedProvider && (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={loadingModels}
              className="px-3 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">{loadingModels ? 'Loading models...' : 'Default model'}</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {!selectedProvider && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={(e) => setFreeOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border"
              />
              Free only
            </label>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto border border-border rounded-lg p-4 mb-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm text-center mt-8">
            Send a message to test your providers.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[80%] rounded-lg px-4 py-3',
              msg.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'bg-muted',
            )}
          >
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            {msg.provider && (
              <p className="text-xs mt-2 opacity-60">
                {msg.provider} / {msg.model}
              </p>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 px-4 py-2.5 rounded-md border border-border bg-background text-sm outline-none focus:border-primary resize-none"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
