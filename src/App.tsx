import { Simple } from './pages/Simple.tsx'
import { ThemeProvider } from './theme.tsx'

export default function App() {
  return (
    <ThemeProvider>
      <Simple />
    </ThemeProvider>
  )
}
