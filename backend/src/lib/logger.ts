import pino from 'pino'

// Logger estructurado (JSON) en vez de console.log/console.error. Cada línea
// es un objeto JSON con nivel, timestamp y campos adicionales (reqId, módulo,
// etc.), lo que permite filtrar/buscar logs en cualquier agregador (Vercel
// Logs, Datadog, etc.) en vez de parsear texto libre.
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
})

export default logger
