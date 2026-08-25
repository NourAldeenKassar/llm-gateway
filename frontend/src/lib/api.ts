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

export async function getConfig(): Promise<GatewayConfig> {
  const { data } = await api.get('/api/admin/config')
  return data
}

export async function updateConfig(updates: Partial<GatewayConfig>) {
  const { data } = await api.patch('/api/admin/config', updates)
  return data
}

export async function getHealth() {
  const { data } = await api.get('/api/health')
  return data
}
