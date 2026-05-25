'use client'

import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useEffect, useState } from 'react'

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!mounted) return <div className="h-8 w-full" />

  const isDark = theme === 'dark'

  return (
    <div 
      className="flex items-center justify-between w-full p-0.5 border rounded-xl cursor-pointer relative overflow-hidden h-8"
      style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-main)' }}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {/* Sliding Background */}
      <motion.div 
        animate={{ x: isDark ? '96%' : '4%' }}
        className="absolute inset-y-0.5 w-[48%] shadow-sm rounded-lg" 
        style={{ backgroundColor: 'var(--bg-sidebar)' }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />

      <div className="flex-1 flex justify-center items-center z-10">
        <Sun size={12} style={{ color: !isDark ? 'var(--text-main)' : 'var(--text-muted)' }} />
      </div>
      
      <div className="flex-1 flex justify-center items-center z-10">
        <Moon size={12} style={{ color: isDark ? 'var(--text-main)' : 'var(--text-muted)' }} />
      </div>
    </div>
  )
}
