import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Permite acceder al servidor de desarrollo desde otros dispositivos
  // de la misma red local (ej. celular o PC accediendo por 192.168.x.x).
  // Next.js no soporta rangos CIDR aquí, hay que listar el host exacto.
  // Si tu IP local cambia, agrégala a esta lista.
  allowedDevOrigins: ['192.168.0.13', '192.168.1.8'],
}

export default nextConfig
