import { cn } from '@/lib/utils'

const endpoints = [
  {
    method: 'POST',
    path: '/api/generate',
    auth: 'API Key',
    description: 'Generate a text response from the best available provider.',
    request: {
      headers: {
        'Authorization': 'Bearer <GATEWAY_API_KEY>',
        'Content-Type': 'application/json',
      },
      body: {
        prompt: { type: 'string', required: true, description: 'The prompt to send' },
        system: { type: 'string', required: false, description: 'System message for context' },
        freeOnly: { type: 'boolean', required: false, description: 'Restrict to free-tier providers (default: from settings)' },
        temperature: { type: 'number', required: false, description: 'Sampling temperature (default: 0.7)' },
        maxTokens: { type: 'number', required: false, description: 'Maximum tokens in response' },
      },
    },
    response: `{
  "text": "Response from the AI",
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
    description: 'Check system health and provider status.',
    request: null,
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
      "error": null,
      "checkedAt": "2026-08-26T00:00:00Z"
    }
  ],
  "lastCheck": "2026-08-26T00:00:00Z"
}`,
    errors: [],
  },
]

const methodColors: Record<string, string> = {
  GET: 'bg-blue-500/10 text-blue-600',
  POST: 'bg-success/10 text-success',
}

export default function Docs() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">API Documentation</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Use these endpoints to integrate the LLM Gateway into your applications.
      </p>

      <div className="flex flex-col gap-8 max-w-3xl">
        {endpoints.map((ep) => (
          <div key={ep.path} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
              <span className={cn('text-xs font-bold px-2 py-1 rounded', methodColors[ep.method])}>
                {ep.method}
              </span>
              <code className="text-sm font-mono font-medium">{ep.path}</code>
              <span className="ml-auto text-xs text-muted-foreground">
                Auth: {ep.auth}
              </span>
            </div>

            <div className="px-5 py-4 space-y-5">
              <p className="text-sm">{ep.description}</p>

              {ep.request && (
                <>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Headers</h4>
                    <div className="bg-muted/30 rounded-lg p-3 font-mono text-xs space-y-1">
                      {Object.entries(ep.request.headers).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-muted-foreground">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Body Parameters</h4>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Parameter</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">Required</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(ep.request.body).map(([name, param], i) => (
                            <tr key={name} className={cn(i < Object.keys(ep.request!.body).length - 1 && 'border-b border-border')}>
                              <td className="px-3 py-2 font-mono text-xs">{name}</td>
                              <td className="px-3 py-2 text-muted-foreground">{param.type}</td>
                              <td className="px-3 py-2 text-center">
                                {param.required ? (
                                  <span className="text-xs text-success font-medium">Yes</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Response</h4>
                <pre className="bg-muted/30 rounded-lg p-3 font-mono text-xs overflow-x-auto">{ep.response}</pre>
              </div>

              {ep.errors.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Errors</h4>
                  <div className="space-y-1">
                    {ep.errors.map((err) => (
                      <div key={err.status} className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs text-destructive font-medium">{err.status}</span>
                        <span className="text-muted-foreground">{err.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
