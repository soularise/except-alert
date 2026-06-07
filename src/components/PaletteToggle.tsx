'use client'

import { useState } from 'react'

type Palette = 'healthcare' | 'monitoring'

const STORAGE_KEY = 'ea-palette'

function getInitialPalette(): Palette {
  if (typeof window === 'undefined') return 'healthcare'
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'monitoring'
      ? 'monitoring'
      : 'healthcare'
  } catch {
    return 'healthcare'
  }
}

export function PaletteToggle() {
  const [palette, setPalette] = useState<Palette>(getInitialPalette)

  function apply(p: Palette) {
    setPalette(p)
    window.localStorage.setItem(STORAGE_KEY, p)
    if (p === 'healthcare') {
      delete document.documentElement.dataset.palette
    } else {
      document.documentElement.dataset.palette = p
    }
  }

  return (
    <div className="flex gap-1 px-3 pb-2">
      <button
        onClick={() => apply('healthcare')}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
          palette === 'healthcare'
            ? 'bg-primary/20 text-primary font-medium'
            : 'text-sidebar-foreground/50 hover:text-sidebar-foreground'
        }`}
      >
        <span className="size-2 rounded-full bg-blue-500" />
        Healthcare
      </button>
      <button
        onClick={() => apply('monitoring')}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
          palette === 'monitoring'
            ? 'bg-primary/20 text-primary font-medium'
            : 'text-sidebar-foreground/50 hover:text-sidebar-foreground'
        }`}
      >
        <span className="size-2 rounded-full bg-teal-500" />
        Monitoring
      </button>
    </div>
  )
}
