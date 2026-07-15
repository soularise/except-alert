'use client'

import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'

export default function LogisticsMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <div className="h-64 overflow-hidden rounded-md border border-border">
      <MapContainer
        center={[latitude, longitude]}
        zoom={12}
        scrollWheelZoom={false}
        className="h-full w-full"
        aria-label="Shipment location map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker center={[latitude, longitude]} radius={10} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.8 }} />
      </MapContainer>
    </div>
  )
}
