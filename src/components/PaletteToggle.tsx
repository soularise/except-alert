'use client'

import { useState } from 'react'
import { Palette } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

type AppPalette = 'classic' | 'signal' | 'terminal'

const PALETTE_OPTIONS: Array<{
  value: AppPalette
  label: string
  swatch: string
}> = [
  { value: 'classic',  label: 'Classic',  swatch: 'bg-blue-500' },
  { value: 'signal',   label: 'Signal',   swatch: 'bg-teal-500' },
  { value: 'terminal', label: 'Terminal', swatch: 'bg-green-400' },
]

const STORAGE_KEY = 'ea-palette'

function normalizePalette(value: string | null): AppPalette {
  if (value === 'terminal') return 'terminal'
  if (value === 'signal' || value === 'monitoring') return 'signal'
  return 'classic'
}

function getInitialPalette(): AppPalette {
  if (typeof window === 'undefined') return 'classic'
  try {
    return normalizePalette(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'classic'
  }
}

export function PaletteToggle() {
  const [palette, setPalette] = useState<AppPalette>(getInitialPalette)
  const selectedOption = PALETTE_OPTIONS.find((option) => option.value === palette) ?? PALETTE_OPTIONS[0]

  function apply(p: AppPalette) {
    setPalette(p)
    window.localStorage.setItem(STORAGE_KEY, p)
    if (p === 'classic') {
      delete document.documentElement.dataset.palette
    } else {
      document.documentElement.dataset.palette = p
    }
  }

  return (
    <div className="px-2 pb-3">
      <Select value={palette} onValueChange={(value) => apply(normalizePalette(value))}>
        <SelectTrigger className="h-8 w-full border-sidebar-border/70 bg-sidebar-accent/40 px-3 text-sidebar-foreground hover:bg-sidebar-accent">
          <Palette className="size-4 shrink-0 text-sidebar-foreground/50" />
          <span className="flex flex-1 items-center gap-1.5 text-left text-sm">
            <span className={`size-2 rounded-full ${selectedOption.swatch}`} />
            {selectedOption.label}
          </span>
        </SelectTrigger>
        <SelectContent align="start" side="top" className="min-w-40">
          {PALETTE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className={`size-2 rounded-full ${option.swatch}`} />
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
