'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet's default marker icons broken by Webpack/Next.js bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export type SignalStatus = 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'

export interface MapSignal {
  id: string
  signal_code: string
  address: string | null
  status: SignalStatus
  latitude: number
  longitude: number
  municipalities: { id: string; name: string } | null
  zones: { id: string; name: string; zone_type: string } | null
  signal_categories: { name: string } | null
  signal_types: { name: string; code: string | null } | null
}

interface MapViewProps {
  signals: MapSignal[]
  center?: [number, number]
  zoom?: number
}

const STATUS_COLORS: Record<SignalStatus, string> = {
  BUENO: '#10b981',       // emerald
  REGULAR: '#f59e0b',     // amber
  DETERIORADO: '#f97316', // orange
  CAIDO: '#f43f5e',       // rose
  DESAPARECIDO: '#71717a', // zinc
}

const STATUS_LABELS: Record<SignalStatus, string> = {
  BUENO: 'Bueno',
  REGULAR: 'Regular',
  DETERIORADO: 'Deteriorado',
  CAIDO: 'Caído',
  DESAPARECIDO: 'Desaparecido',
}

function createMarkerIcon(status: SignalStatus) {
  const color = STATUS_COLORS[status]
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="6" fill="white" fill-opacity="0.9"/>
    </svg>`

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  })
}

export default function MapView({
  signals,
  center = [5.0, -75.5], // Colombia center
  zoom = 7,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update markers when signals change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer)
    })

    signals.forEach((signal) => {
      const marker = L.marker([signal.latitude, signal.longitude], {
        icon: createMarkerIcon(signal.status),
      })

      marker.bindPopup(`
        <div style="min-width:220px;font-family:system-ui,sans-serif">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px">${signal.signal_code}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="
              background:${STATUS_COLORS[signal.status]};
              color:white;
              font-size:11px;
              font-weight:600;
              padding:2px 8px;
              border-radius:999px
            ">${STATUS_LABELS[signal.status]}</span>
          </div>
          ${signal.address ? `<div style="font-size:12px;color:#555;margin-bottom:4px">📍 ${signal.address}</div>` : ''}
          ${signal.municipalities ? `<div style="font-size:12px;color:#555;margin-bottom:4px">🏙 ${signal.municipalities.name}</div>` : ''}
          ${signal.signal_categories ? `<div style="font-size:12px;color:#555;margin-bottom:4px">🏷 ${signal.signal_categories.name}</div>` : ''}
          ${signal.signal_types ? `<div style="font-size:12px;color:#555">🔖 ${signal.signal_types.name}${signal.signal_types.code ? ` (${signal.signal_types.code})` : ''}</div>` : ''}
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid #eee">
            <a href="/dashboard/signals/${signal.id}"
              style="font-size:12px;color:#059669;font-weight:600;text-decoration:none">
              Ver detalle →
            </a>
          </div>
        </div>
      `)

      marker.addTo(map)
    })

    // Fit bounds if there are signals
    if (signals.length > 0) {
      const bounds = L.latLngBounds(signals.map((s) => [s.latitude, s.longitude]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [signals])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
