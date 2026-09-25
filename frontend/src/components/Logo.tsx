// Marca de SIGSEV: triángulo de advertencia + carretera en curva de S + punto
// de ubicación, en trazo blanco sobre degradado brand-bright -> brand.
export default function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" role="img" aria-labelledby="sigsevMarkTitle" className={className}>
      <title id="sigsevMarkTitle">SIGSEV</title>
      <defs>
        <linearGradient id="sigsevMarkGradient" x1="0" y1="0" x2="72" y2="72">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="72" height="72" rx="16" fill="url(#sigsevMarkGradient)" />
      <path d="M36 14 L44 27 L28 27 Z" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M36 27 C48 31 48 41 36 43 C24 45 24 53 36 57" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="36" cy="57" r="4" fill="#ffffff" />
    </svg>
  )
}
