import { Request, Response, NextFunction } from 'express'
import { createFromMock } from '../test-utils/supabaseMock'

jest.mock('../lib/supabase', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import supabase from '../lib/supabase'
import { requireRole } from './requireRole.middleware'

const mockReqRes = (userId?: string) => {
  const req = { user: userId ? { userId, role_id: null } : undefined } as unknown as Request
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response
  const next = jest.fn() as NextFunction
  return { req, res, next }
}

describe('requireRole middleware', () => {
  it('responde 401 si no hay usuario autenticado en req.user', async () => {
    const { req, res, next } = mockReqRes(undefined)
    const middleware = requireRole('ADMIN')

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('responde 403 si el rol del usuario no está en la lista permitida', async () => {
    ;(supabase.from as jest.Mock) = createFromMock({
      users: { data: { roles: { name: 'TECNICO' } }, error: null },
    })

    const { req, res, next } = mockReqRes('user-1')
    const middleware = requireRole('ADMIN', 'SUPERVISOR')

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('llama a next() y cachea roleName si el rol está permitido', async () => {
    ;(supabase.from as jest.Mock) = createFromMock({
      users: { data: { roles: { name: 'ADMIN' } }, error: null },
    })

    const { req, res, next } = mockReqRes('user-1')
    const middleware = requireRole('ADMIN', 'SUPERVISOR')

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
    expect(req.user?.roleName).toBe('ADMIN')
  })

  it('responde 401 si el usuario no existe en la base de datos', async () => {
    ;(supabase.from as jest.Mock) = createFromMock({
      users: { data: null, error: null },
    })

    const { req, res, next } = mockReqRes('ghost-user')
    const middleware = requireRole('ADMIN')

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
