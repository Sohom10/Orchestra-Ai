'use client'

import { useTheme } from '@/context/ThemeContext'
import { useEffect, useState } from 'react'

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  
  if (!mounted) return <div className="h-8 w-full" />

  return (
    <div className="w-full">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        className="w-full text-xs font-bold p-2 border cursor-pointer outline-none transition-colors"
        style={{ 
          backgroundColor: 'var(--bg-app)', 
          color: 'var(--text-main)',
          borderColor: 'var(--border-main)',
          borderRadius: 'var(--radius-sm)'
        }}
      >
        <option value="light">Light Mode</option>
        <option value="dark">Dark Mode</option>
        <option value="cyberpunk">Cyberpunk Neon</option>
        <option value="sepia">Academic Sepia</option>
        <option value="midnight">Midnight Blue</option>
      </select>
    </div>
  )
}
