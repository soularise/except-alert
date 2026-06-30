export type AppPalette = 'classic' | 'signal' | 'terminal'

export function normalizeAppPalette(value: string | null | undefined): AppPalette {
  if (value === 'terminal') return 'terminal'
  if (value === 'signal' || value === 'monitoring') return 'signal'
  return 'classic'
}
