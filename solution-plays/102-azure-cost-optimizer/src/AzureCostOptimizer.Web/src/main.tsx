import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, readThemeChoice } from './theme.ts'

// Resolved before the first render so the shell never paints in the wrong theme.
applyTheme(readThemeChoice())

createRoot(document.getElementById('root')!).render(
  <App />,
)
