/**
 * Helper para simular el query builder fluido de @supabase/supabase-js en tests
 * unitarios, sin abrir una conexión real. Cada método de la cadena
 * (.select/.eq/.in/.insert/...) devuelve el mismo objeto "builder" para permitir
 * encadenamiento arbitrario, y el builder es "thenable" para que `await query`
 * resuelva directamente al resultado configurado — igual que el cliente real.
 */
export interface MockQueryResult {
  data?: unknown
  error?: { message: string } | null
  count?: number | null
}

export type MockQueryBuilder = {
  [key: string]: jest.Mock
} & PromiseLike<MockQueryResult>

const CHAINABLE_METHODS = [
  'select', 'eq', 'neq', 'in', 'order', 'range', 'limit',
  'insert', 'update', 'delete', 'upsert',
]

export const createQueryBuilder = (result: MockQueryResult): MockQueryBuilder => {
  const builder = {} as MockQueryBuilder

  for (const method of CHAINABLE_METHODS) {
    builder[method] = jest.fn(() => builder)
  }

  // single()/maybeSingle() son los puntos terminales más comunes: siguen
  // siendo "thenable" (resuelven al mismo resultado) en vez de devolver el
  // builder, para que `await query.maybeSingle()` funcione igual que en runtime.
  builder.single = jest.fn(() => Promise.resolve(result))
  builder.maybeSingle = jest.fn(() => Promise.resolve(result))

  builder.then = ((onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected)) as MockQueryBuilder['then']

  return builder
}

/**
 * Crea un mock de `supabase.from` que despacha según el nombre de tabla.
 * `routes` mapea tableName -> MockQueryResult (o una función que devuelve uno,
 * útil cuando una misma tabla se consulta más de una vez con resultados distintos).
 */
export const createFromMock = (
  routes: Record<string, MockQueryResult | (() => MockQueryResult)>
) => {
  return jest.fn((table: string) => {
    const route = routes[table]
    if (!route) {
      throw new Error(`[supabaseMock] No hay ruta configurada para la tabla "${table}"`)
    }
    const result = typeof route === 'function' ? route() : route
    return createQueryBuilder(result)
  })
}
