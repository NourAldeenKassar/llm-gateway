import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
})

export interface Provider {
  id: string
  name: string
  displayName: string
  type: string
  apiKey: string
  baseUrl: string | null
  defaultModel: string
  isPaid: boolean
  enabled: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface GatewayConfig {
  id: string
  defaultProvider: string | null
  freeOnlyDefault: boolean
}

export interface TestResult {
  success: boolean
  response?: string
  model?: string
  provider?: string
  error?: string
}

export async function login(password: string) {
  const { data } = await api.post('/api/admin/login', { password })
  return data
}

export async function logout() {
  const { data } = await api.post('/api/admin/logout')
  return data
}

export async function checkSession() {
  const { data } = await api.get('/api/admin/session')
  return data
}

export async function listProviders(): Promise<Provider[]> {
  const { data } = await api.get('/api/admin/providers')
  return data
}

export async function createProvider(provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>) {
  const { data } = await api.post('/api/admin/providers', provider)
  return data
}

export async function updateProvider(id: string, updates: Partial<Provider>) {
  const { data } = await api.patch(`/api/admin/providers/${id}`, updates)
  return data
}

export async function deleteProvider(id: string) {
  const { data } = await api.delete(`/api/admin/providers/${id}`)
  return data
}

export async function testProvider(id: string): Promise<TestResult> {
  const { data } = await api.post(`/api/admin/providers/${id}/test`)
  return data
}

export async function listModels(providerId: string): Promise<string[]> {
  const { data } = await api.get(`/api/admin/providers/${providerId}/models`)
  return data.models
}

export async function getConfig(): Promise<GatewayConfig> {
  const { data } = await api.get('/api/admin/config')
  return data
}

export async function updateConfig(updates: Partial<GatewayConfig>) {
  const { data } = await api.patch('/api/admin/config', updates)
  return data
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  provider?: string
  model?: string
  createdAt: string
}

export interface ConversationWithMessages extends Conversation {
  messages: ChatMessage[]
}

export async function listConversations(): Promise<Conversation[]> {
  const { data } = await api.get('/api/admin/conversations')
  return data
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  const { data } = await api.get(`/api/admin/conversations/${id}`)
  return data
}

export async function deleteConversation(id: string) {
  const { data } = await api.delete(`/api/admin/conversations/${id}`)
  return data
}

export interface ProviderHealth {
  name: string
  displayName: string
  isPaid: boolean
  status: 'healthy' | 'unhealthy'
  latencyMs: number | null
  error: string | null
  checkedAt: string
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unchecked'
  database: 'ok' | 'error'
  providers: ProviderHealth[]
  lastCheck: string | null
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await api.post('/api/admin/change-password', { currentPassword, newPassword })
  return data
}

export async function getHealth(): Promise<HealthStatus> {
  const { data } = await api.get('/api/health')
  return data
}

export async function runHealthCheck(): Promise<HealthStatus> {
  const { data } = await api.post('/api/health/check')
  return data
}

export interface ProviderStat {
  provider: string
  model: string
  total: number
  success: number
  errors: number
  rateLimited: number
  avgLatency: number
  lastMinute: number
  lastHour: number
}

export interface RequestLogEntry {
  id: string
  provider: string
  model: string
  status: string
  latencyMs: number
  totalTokens: number | null
  error: string | null
  source: string | null
  createdAt: string
}

export interface MonitoringData {
  overview: {
    requestsToday: number
    requestsThisWeek: number
    requestsLastMinute: number
    requestsLastHour: number
    rateLimitsToday: number
    errorsToday: number
  }
  providerStats: ProviderStat[]
  recentLogs: RequestLogEntry[]
}

export async function getMonitoring(): Promise<MonitoringData> {
  const { data } = await api.get('/api/admin/monitoring')
  return data
}
