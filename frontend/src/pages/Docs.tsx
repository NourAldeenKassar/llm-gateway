import { cn } from '@/lib/utils'

const endpoints = [
  {
    method: 'POST',
    path: '/api/generate',
    auth: 'API Key',
    description: 'Generate a text response from the best available provider. The gateway handles provider selection and fallback automatically.',
    request: {
      headers: {
        'Authorization': 'Bearer <GATEWAY_API_KEY>',
        'Content-Type': 'application/json',
      },
      body: [
        { name: 'prompt', type: 'string', required: true, description: 'The prompt to send' },
        { name: 'system', type: 'string', required: false, description: 'System message for context' },
        { name: 'freeOnly', type: 'boolean', required: false, description: 'Restrict to free-tier providers (default: from settings)' },
        { name: 'temperature', type: 'number', required: false, description: 'Sampling temperature (default: 0.7)' },
        { name: 'maxTokens', type: 'number', required: false, description: 'Maximum tokens in response' },
      ],
    },
    example: `curl -X POST https://your-gateway/api/generate \\
  -H "Authorization: Bearer your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "What is 2+2?",
    "freeOnly": true
  }'`,
    response: `{
  "text": "4",
  "provider": "groq",
  "model": "openai/gpt-oss-120b"
}`,
    errors: [
      { status: 401, description: 'Missing or invalid API key' },
      { status: 503, description: 'All providers failed or none available' },
    ],
  },
  {
    method: 'GET',
    path: '/api/health',
    auth: 'None',
    description: 'Returns system health status and cached provider health from the last manual check.',
    request: null,
    example: `curl https://your-gateway/api/health`,
    response: `{
  "status": "healthy",
  "database": "ok",
  "providers": [
    {
      "name": "groq",
      "displayName": "Groq",
      "isPaid": false,
      "status": "healthy",
      "latencyMs": 370,
      "error": null
    }
  ],
  "lastCheck": "2026-08-26T00:00:00Z"
}`,
    errors: [],
  },
]

const methodColors: Record<string, string> = {
  GET: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
  POST: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
}

export default function Docs() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">API Documentation</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Integrate the LLM Gateway into your applications using these endpoints.
      </p>

      <div className="flex flex-col gap-10 max-w-3xl">
        {endpoints.map((ep) => (
          <div key={ep.path}>
            <div className="flex items-center gap-3 mb-4">
              <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-md border font-[family-name:var(--font-mono)]', methodColors[ep.method])}>
                {ep.method}
              </span>
              <code className="text-base font-[family-name:var(--font-mono)] font-medium tracking-tight">{ep.path}</code>
              {ep.auth !== 'None' && (
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                  {ep.auth}
                </span>
              )}
              {ep.auth === 'None' && (
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Public
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{ep.description}</p>

            {ep.request && (
              <div className="space-y-5 mb-5">
                <Section title="Headers">
                  <div className="bg-[#1a1a2e] rounded-lg p-4 font-[family-name:var(--font-mono)] text-[13px] leading-relaxed">
                    {Object.entries(ep.request.headers).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-blue-400">{key}</span>
                        <span className="text-muted-foreground">: </span>
                        <span className="text-emerald-400">{value}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="Parameters">
                  <div className="space-y-3">
                    {ep.request.body.map((param) => (
                      <div key={param.name} className="flex items-start gap-3 text-sm">
                        <code className="font-[family-name:var(--font-mono)] text-[13px] font-medium bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {param.name}
                        </code>
                        <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-mono)] bg-muted/50 px-1.5 py-0.5 rounded shrink-0">
                          {param.type}
                        </span>
                        {param.required && (
                          <span className="text-[10px] font-semibold text-destructive uppercase shrink-0">required</span>
                        )}
                        <span className="text-muted-foreground">{param.description}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            <Section title="Example">
              <pre className="bg-[#1a1a2e] text-emerald-400 rounded-lg p-4 font-[family-name:var(--font-mono)] text-[13px] leading-relaxed overflow-x-auto">
                {ep.example}
              </pre>
            </Section>

            <div className="mt-5">
              <Section title="Response">
                <pre className="bg-[#1a1a2e] text-gray-300 rounded-lg p-4 font-[family-name:var(--font-mono)] text-[13px] leading-relaxed overflow-x-auto">
                  {ep.response}
                </pre>
              </Section>
            </div>

            {ep.errors.length > 0 && (
              <div className="mt-5">
                <Section title="Errors">
                  <div className="space-y-2">
                    {ep.errors.map((err) => (
                      <div key={err.status} className="flex items-center gap-3 text-sm">
                        <code className="font-[family-name:var(--font-mono)] text-[13px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                          {err.status}
                        </code>
                        <span className="text-muted-foreground">{err.description}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{title}</h4>
      {children}
    </div>
  )
}
