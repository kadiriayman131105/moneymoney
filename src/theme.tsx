import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeName = 'dark' | 'light'

const ThemeContext = createContext<{ theme: ThemeName; toggle: () => void; setTheme: (theme: ThemeName) => void } | null>(null)

function readTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('mm-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18191a' : '#f0f2f5')
  }, [theme])

  const setTheme = (next: ThemeName) => setThemeState(next)
  const toggle = () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme doit être utilisé dans ThemeProvider')
  return value
}
