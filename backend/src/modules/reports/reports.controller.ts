import { Request, Response } from 'express'
import { ZodError } from 'zod'
import * as XLSX from 'xlsx'
import PDFDocument from 'pdfkit'
import {
  reportFiltersSchema,
  getSignalsReportData,
  getInspectionsReportData,
  getMaintenancesReportData,
  getSummaryReportData,
  ReportFilters,
} from './reports.service'

type ReportRow = Record<string, unknown>

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    return res.status(422).json({ message: error.issues.map((i) => i.message).join(', ') })
  }
  if (error instanceof Error) {
    return res.status(400).json({ message: error.message })
  }
  return res.status(500).json({ message: 'Error interno del servidor' })
}

const buildXlsxBuffer = (rows: ReportRow[], sheetName: string): Buffer => {
  const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Sin datos': '' }])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31))
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// Tabla simple sobre pdfkit: pdfkit no trae tablas nativas, así que dibujamos
// encabezado + filas con columnas de ancho fijo y salto de página automático.
const buildPdfBuffer = (title: string, rows: ReportRow[]): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(16).text(title, { align: 'left' })
    doc.fontSize(9).fillColor('#555').text(`Generado: ${new Date().toLocaleString('es-CO')}`)
    doc.moveDown(1)

    const columns = rows.length > 0 ? Object.keys(rows[0]) : ['Sin datos']
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const colWidth = pageWidth / columns.length
    const rowHeight = 20

    const drawRow = (values: string[], y: number, isHeader = false) => {
      doc.fontSize(8).fillColor(isHeader ? '#000' : '#222')
      if (isHeader) doc.font('Helvetica-Bold')
      else doc.font('Helvetica')
      values.forEach((val, i) => {
        doc.text(String(val ?? ''), doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
          height: rowHeight,
          ellipsis: true,
        })
      })
    }

    let y = doc.y
    drawRow(columns, y, true)
    y += rowHeight
    doc.moveTo(doc.page.margins.left, y - 2)
      .lineTo(doc.page.width - doc.page.margins.right, y - 2)
      .strokeColor('#ccc').stroke()

    const bottomLimit = doc.page.height - doc.page.margins.bottom

    if (rows.length === 0) {
      doc.fontSize(10).fillColor('#888').text('No hay datos para los filtros seleccionados.', doc.page.margins.left, y + 10)
    }

    for (const row of rows) {
      if (y + rowHeight > bottomLimit) {
        doc.addPage()
        y = doc.page.margins.top
        drawRow(columns, y, true)
        y += rowHeight
      }
      drawRow(columns.map((c) => String(row[c] ?? '')), y)
      y += rowHeight
    }

    doc.end()
  })
}

const sendReport = async (
  req: Request,
  res: Response,
  getData: (filters: ReportFilters) => Promise<ReportRow[]>,
  filenameBase: string,
  title: string
) => {
  try {
    const filters = reportFiltersSchema.parse(req.query)
    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx'
    const rows = await getData(filters)

    if (format === 'pdf') {
      const buffer = await buildPdfBuffer(title, rows)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`)
      return res.send(buffer)
    }

    const buffer = buildXlsxBuffer(rows, title)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`)
    return res.send(buffer)
  } catch (error) {
    return handleError(res, error)
  }
}

export const signalsReport = (req: Request, res: Response) =>
  sendReport(req, res, getSignalsReportData, 'reporte-senales', 'Señales por estado')

export const inspectionsReport = (req: Request, res: Response) =>
  sendReport(req, res, getInspectionsReportData, 'reporte-inspecciones', 'Inspecciones por período')

export const maintenancesReport = (req: Request, res: Response) =>
  sendReport(req, res, getMaintenancesReportData, 'reporte-mantenimientos', 'Mantenimientos por período')

export const summaryReport = (req: Request, res: Response) =>
  sendReport(req, res, getSummaryReportData, 'reporte-resumen', 'Resumen general')
