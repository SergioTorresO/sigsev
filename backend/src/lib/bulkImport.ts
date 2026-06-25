import multer from 'multer'
import * as XLSX from 'xlsx'

// Helpers compartidos para la carga masiva (CSV/Excel) de signals y zones.
// Antes esta lógica estaba duplicada casi al pie de la letra en
// signals.service.ts/signals.controller.ts y zones.service.ts/zones.controller.ts;
// se extrajo aquí para que un cambio (p.ej. nuevas extensiones permitidas, o un
// fix de seguridad en el parseo de XLSX) se aplique una sola vez a ambos módulos.

export interface BulkImportRowError {
  row: number
  message: string
}

export class BulkImportError extends Error {
  errors: BulkImportRowError[]
  constructor(errors: BulkImportRowError[]) {
    super('Errores de validación en el archivo')
    this.errors = errors
  }
}

const DIACRITICS_REGEX = new RegExp('[̀-ͯ]', 'g')

// Normaliza un encabezado de columna (español/inglés, con o sin tildes,
// con espacios) a snake_case en minúsculas para poder mapearlo contra un
// diccionario de alias propio de cada módulo.
export const normalizeHeader = (h: string) =>
  h
    .toString()
    .replace(/^﻿/, '') // BOM que algunos editores/Excel agregan al primer encabezado
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .replace(/\s+/g, '_')

// Excel/CSV a veces interpreta una celda con pinta de fecha ("2024-03-10")
// y SheetJS la entrega como número de serie (p.ej. 45361) en vez de texto.
// Lo normalizamos de vuelta a un string "YYYY-MM-DD"; para el resto de
// valores simplemente los convierte a string de forma segura.
export const rawToText = (val: unknown): string => {
  if (val === undefined || val === null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed && parsed.y) {
      const mm = String(parsed.m).padStart(2, '0')
      const dd = String(parsed.d).padStart(2, '0')
      return `${parsed.y}-${mm}-${dd}`
    }
    return String(val)
  }
  return String(val)
}

const ALLOWED_IMPORT_EXTENSIONS = ['.csv', '.xlsx', '.xls']
const ALLOWED_IMPORT_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Algunos navegadores envían CSV/Excel como octet-stream genérico;
  // la extensión sigue validándose de todas formas.
  'application/octet-stream',
]

// Middleware de multer para carga masiva: memoria (no se escribe a disco),
// máx. 5MB, un solo archivo, y restringido a .csv/.xlsx/.xls por extensión y
// MIME type. SEGURIDAD: la librería `xlsx` (SheetJS) tiene vulnerabilidades
// conocidas de prototype pollution/ReDoS al parsear archivos maliciosos.
// Mientras no se actualice a un build parcheado (cdn.sheetjs.com, no
// disponible en npm), esto reduce la superficie de ataque.
export const createBulkImportUpload = () =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      const name = (file.originalname ?? '').toLowerCase()
      const hasAllowedExtension = ALLOWED_IMPORT_EXTENSIONS.some((ext) => name.endsWith(ext))
      const hasAllowedMimeType = ALLOWED_IMPORT_MIME_TYPES.includes(file.mimetype)
      if (!hasAllowedExtension || !hasAllowedMimeType) {
        return cb(new Error('Solo se permiten archivos .csv, .xlsx o .xls'))
      }
      cb(null, true)
    },
  })

// Lee el archivo subido (buffer de multer) y devuelve sus filas como objetos
// planos (encabezado de columna -> valor de la celda). Lanza Error con un
// mensaje apto para el usuario si el archivo no se puede leer.
export const parseSpreadsheetRows = (file: Express.Multer.File): Record<string, unknown>[] => {
  // Los .csv los decodificamos manualmente como UTF-8 antes de pasarlos a
  // XLSX; si se leen directo del buffer, XLSX adivina el codepage y con
  // acentos/ñ produce caracteres corruptos (mojibake), p.ej. "Itagüí" ->
  // "ItagÃ¼Ã­". Los .xlsx/.xls (binarios) sí se leen como buffer normal.
  const isCsv = (file.originalname ?? '').toLowerCase().endsWith('.csv')
  // bookVBA/bookFiles en false evita que se procesen macros u objetos
  // embebidos del archivo, que es donde suelen apuntar los exploits conocidos
  // de SheetJS.
  const readOptions = { bookVBA: false, bookFiles: false }
  const workbook = isCsv
    ? XLSX.read(file.buffer.toString('utf-8').replace(/^﻿/, ''), { type: 'string', ...readOptions })
    : XLSX.read(file.buffer, { type: 'buffer', ...readOptions })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('El archivo no contiene hojas')
  }
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
}
