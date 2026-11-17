export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'llm-gateway-theme'

export function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

export function getSystemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // storage unavailable (private mode); the class is still applied
  }
}
