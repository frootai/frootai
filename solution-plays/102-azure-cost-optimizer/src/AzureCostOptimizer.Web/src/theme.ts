export type ThemeChoice = 'light' | 'dark' | 'system'

const storageKey = 'aco-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    // Storage can be blocked entirely; following the OS is the safe default.
    return 'system'
  }
}

export function resolveTheme(choice: ThemeChoice) {
  return choice === 'system' ? (media().matches ? 'dark' : 'light') : choice
}

// Every rule keys off <html data-theme>, so the OS preference and an explicit choice share one path.
export function applyTheme(choice: ThemeChoice) {
  const resolved = resolveTheme(choice)
  document.documentElement.dataset.theme = resolved
  try {
    if (choice === 'system') localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, choice)
  } catch { /* a blocked store only costs the preference, not the theme */ }
  return resolved
}

export function watchSystemTheme(onChange: () => void) {
  const query = media()
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
