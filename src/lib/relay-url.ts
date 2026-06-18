export type RelayUrlResolution =
  | { url: string; error: null }
  | { url: null; error: string }

export function resolveRelayUrl(request: Request): RelayUrlResolution {
  const configured = process.env.RELAY_URL?.trim()
  if (configured) {
    return { url: configured.replace(/\/+$/, ''), error: null }
  }

  if (process.env.NODE_ENV === 'production') {
    return {
      url: null,
      error: 'RELAY_URL is not configured. Set it to the public HTTPS Relay origin before copying webhook URLs.',
    }
  }

  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  const hostHeader = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost'
  const hostname = hostHeader.startsWith('[')
    ? hostHeader.slice(1, hostHeader.indexOf(']'))
    : hostHeader.split(':')[0]

  return { url: `${proto}://${hostname}:3800`, error: null }
}
