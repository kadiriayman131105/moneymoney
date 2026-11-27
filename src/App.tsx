import { PasswordGate } from './PasswordGate.tsx'
import { Simple } from './pages/Simple.tsx'
import { ThemeProvider } from './theme.tsx'

export default function App() {
  return (
    <ThemeProvider>
      <PasswordGate>
        <Simple />
      </PasswordGate>
    </ThemeProvider>
  )
}
