import { Request, Response } from 'express'
import { ZodError } from 'zod'
import { getAuditLogs, auditFiltersSchema } from './audit.service'

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    return res.status(422).json({ message: error.issues.map((i) => i.message).join(', ') })
  }
  if (error instanceof Error) {
    return res.status(400).json({ message: error.message })
  }
  return res.status(500).json({ message: 'Error interno del servidor' })
}

export const list = async (req: Request, res: Response) => {
  try {
    const filters = auditFiltersSchema.parse(req.query)
    const result = await getAuditLogs(filters)
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}
