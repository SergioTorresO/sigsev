import { createQueryBuilder } from '../../test-utils/supabaseMock'

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}))

jest.mock('../notifications/notifications.service', () => ({
  createNotification: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import supabase from '../../lib/supabase'
import { bulkImportSignals, BulkImportError } from './signals.service'

const CATALOGS = {
  signal_categories: [{ id: 'cat-1', name: 'Señal de pare' }],
  signal_types: [{ id: 'type-1', name: 'Pare' }],
  municipalities: [{ id: 'muni-1', name: 'Medellín' }],
  zones: [] as { id: string; name: string }[],
}

let signalsCallCount = 0
let insertedRows: unknown[] | null = null

/**
 * `signals` se consulta dos veces dentro de bulkImportSignals: primero para
 * chequear códigos duplicados (.select().in()), y luego para el insert final
 * (.insert().select()). Este dispatcher distingue ambas llamadas por orden.
 */
const buildFromMock = (existingCodes: { signal_code: string }[], insertResult: { data: unknown; error: { message: string } | null }) => {
  signalsCallCount = 0
  insertedRows = null

  return jest.fn((table: string) => {
    if (table === 'signal_categories') return createQueryBuilder({ data: CATALOGS.signal_categories, error: null })
    if (table === 'signal_types') return createQueryBuilder({ data: CATALOGS.signal_types, error: null })
    if (table === 'municipalities') return createQueryBuilder({ data: CATALOGS.municipalities, error: null })
    if (table === 'zones') return createQueryBuilder({ data: CATALOGS.zones, error: null })

    if (table === 'signals') {
      signalsCallCount += 1
      if (signalsCallCount === 1) {
        return createQueryBuilder({ data: existingCodes, error: null })
      }
      const builder = createQueryBuilder(insertResult)
      const originalInsert = builder.insert
      builder.insert = jest.fn((rows: unknown[]) => {
        insertedRows = rows
        return originalInsert(rows)
      })
      return builder
    }

    throw new Error(`[test] tabla no mockeada: ${table}`)
  })
}

const validRow = {
  Codigo: 'S-001',
  Categoria: 'Señal de pare',
  'Tipo de senal': 'Pare',
  Municipio: 'Medellín',
  Latitud: '6.25',
  Longitud: '-75.56',
}

describe('bulkImportSignals — todo o nada', () => {
  it('rechaza el archivo completo si una fila tiene un dato inválido (no inserta nada)', async () => {
    ;(supabase.from as jest.Mock) = buildFromMock([], { data: [], error: null })

    const invalidRow = { ...validRow, Codigo: 'S-002', Categoria: 'Categoría inexistente' }

    await expect(
      bulkImportSignals([validRow, invalidRow], 'user-1')
    ).rejects.toBeInstanceOf(BulkImportError)

    // Como hay un error de validación, nunca debe llegar a consultar
    // duplicados ni a insertar — ni una sola fila se procesa.
    expect(signalsCallCount).toBe(0)
    expect(insertedRows).toBeNull()
  })

  it('rechaza el archivo completo si algún código ya existe en la base (no inserta nada)', async () => {
    ;(supabase.from as jest.Mock) = buildFromMock([{ signal_code: 'S-001' }], { data: [], error: null })

    await expect(
      bulkImportSignals([validRow], 'user-1')
    ).rejects.toBeInstanceOf(BulkImportError)

    expect(insertedRows).toBeNull()
  })

  it('inserta todas las filas válidas en una sola llamada atómica', async () => {
    ;(supabase.from as jest.Mock) = buildFromMock([], { data: [{ id: 'new-1' }, { id: 'new-2' }], error: null })

    const secondRow = { ...validRow, Codigo: 'S-002' }

    const result = await bulkImportSignals([validRow, secondRow], 'user-1')

    expect(result.inserted).toBe(2)
    expect(insertedRows).toHaveLength(2)
    expect((insertedRows as { signal_code: string }[]).map((r) => r.signal_code)).toEqual(['S-001', 'S-002'])
  })

  it('rechaza el archivo si dos filas usan el mismo código (duplicado dentro del propio archivo)', async () => {
    ;(supabase.from as jest.Mock) = buildFromMock([], { data: [], error: null })

    const duplicateRow = { ...validRow }

    await expect(
      bulkImportSignals([validRow, duplicateRow], 'user-1')
    ).rejects.toBeInstanceOf(BulkImportError)

    expect(insertedRows).toBeNull()
  })
})
