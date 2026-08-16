'use client'

import dynamic from 'next/dynamic'
import { ExternalLink, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const LogisticsMap = dynamic(() => import('@/components/LogisticsMap'), { ssr: false })

type LogisticsContextProps = {
  tags: unknown
}

type Logistics = {
  provider?: string
  alertId?: string
  deviceId?: string
  shipmentId?: string
  eventId?: string
  organizationId?: string
  condition?: string
  vehicle?: {
    id?: string
    name?: string
    serial?: string
    vin?: string
  }
  fault?: {
    condition?: string
    details?: string
    summary?: string
  }
  temperature?: {
    value?: number
    unit?: string
    minimum?: number
    maximum?: number
  }
  location?: {
    latitude?: number
    longitude?: number
    accuracy?: number
    source?: string
    address?: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseLogistics(tags: unknown): Logistics | null {
  if (!isRecord(tags) || !isRecord(tags.logistics)) return null
  const raw = tags.logistics
  const temperature = isRecord(raw.temperature) ? raw.temperature : null
  const location = isRecord(raw.location) ? raw.location : null
  const vehicle = isRecord(raw.vehicle) ? raw.vehicle : null
  const fault = isRecord(raw.fault) ? raw.fault : null

  return {
    provider: asString(raw.provider),
    alertId: asString(raw.alertId),
    deviceId: asString(raw.deviceId),
    shipmentId: asString(raw.shipmentId),
    eventId: asString(raw.eventId),
    organizationId: raw.organizationId === undefined ? undefined : String(raw.organizationId),
    condition: asString(raw.condition),
    vehicle: vehicle
      ? {
          id: vehicle.id === undefined ? undefined : String(vehicle.id),
          name: asString(vehicle.name),
          serial: asString(vehicle.serial),
          vin: asString(vehicle.vin),
        }
      : undefined,
    fault: fault
      ? {
          condition: asString(fault.condition),
          details: asString(fault.details),
          summary: asString(fault.summary),
        }
      : undefined,
    temperature: temperature
      ? {
          value: asNumber(temperature.value),
          unit: asString(temperature.unit),
          minimum: asNumber(temperature.minimum),
          maximum: asNumber(temperature.maximum),
        }
      : undefined,
    location: location
      ? {
          latitude: asNumber(location.latitude),
          longitude: asNumber(location.longitude),
          accuracy: asNumber(location.accuracy),
          source: asString(location.source),
          address: asString(location.address),
        }
      : undefined,
  }
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
    </div>
  )
}

export function LogisticsContext({ tags }: LogisticsContextProps) {
  const logistics = parseLogistics(tags)
  if (!logistics) return null

  const location = logistics.location
  const coordinates = location
    && typeof location.latitude === 'number'
    && typeof location.longitude === 'number'
    ? { latitude: location.latitude, longitude: location.longitude }
    : null
  const mapsUrl = coordinates
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)}`
    : null
  const temperature = logistics.temperature?.value
  const unit = logistics.temperature?.unit ?? '°C'
  const temperatureText = typeof temperature === 'number' ? `${temperature}${unit}` : undefined
  const rangeText = logistics.temperature
    && (typeof logistics.temperature.minimum === 'number' || typeof logistics.temperature.maximum === 'number')
    ? `${logistics.temperature.minimum ?? '—'} to ${logistics.temperature.maximum ?? '—'}${unit}`
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logistics Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Provider" value={logistics.provider} />
          <Detail label="Condition" value={logistics.condition} />
          <Detail label="Temperature" value={temperatureText} />
          <Detail label="Allowed range" value={rangeText} />
          <Detail label="Shipment" value={logistics.shipmentId} />
          <Detail label="Device" value={logistics.deviceId} />
          <Detail label="Vendor alert" value={logistics.alertId} />
          <Detail label="Event ID" value={logistics.eventId} />
          <Detail label="Organization" value={logistics.organizationId} />
          <Detail label="Vehicle" value={logistics.vehicle?.name} />
          <Detail label="Vehicle ID" value={logistics.vehicle?.id} />
          <Detail label="Vehicle serial" value={logistics.vehicle?.serial} />
          <Detail label="Vehicle VIN" value={logistics.vehicle?.vin} />
          <Detail label="Fault condition" value={logistics.fault?.condition} />
          <Detail label="Fault summary" value={logistics.fault?.summary} />
          <Detail label="Fault evidence" value={logistics.fault?.details} />
          <Detail label="Location source" value={location?.source} />
          <Detail label="Location accuracy" value={typeof location?.accuracy === 'number' ? `${location.accuracy} m` : undefined} />
        </dl>

        {coordinates ? (
          <div className="space-y-3">
            <LogisticsMap latitude={coordinates.latitude} longitude={coordinates.longitude} />
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{location?.address ?? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`}</span>
              {mapsUrl && (
                <a
                  className="inline-flex items-center gap-1 text-primary underline hover:text-primary/80"
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" />
            Location unavailable for this event.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
