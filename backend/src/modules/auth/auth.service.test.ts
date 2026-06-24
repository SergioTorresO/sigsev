import { createFromMock } from '../../test-utils/supabaseMock'

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  default: { from: jest.fn() },
}))

jest.mock('../../lib/email', () => ({
  isEmailConfigured: jest.fn(() => false),
  sendPasswordResetEmail: jest.fn(),
}))

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'fake-jwt-token'),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import supabase from '../../lib/supabase'
import bcrypt from 'bcryptjs'
import { loginUser } from './auth.service'

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret' }
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe('loginUser', () => {
  const dbUser = {
    id: 'user-1',
    full_name: 'Checho Tester',
    email: 'checho@example.com',
    phone: '3000000000',
    is_active: true,
    role_id: 'role-1',
    password: 'hashed-password',
    created_at: '2026-01-01T00:00:00.000Z',
    roles: { id: 'role-1', name: 'ADMIN', description: 'Administrador' },
  }

  it('devuelve token y usuario (sin password) con credenciales correctas', async () => {
    ;(supabase.from as jest.Mock) = createFromMock({
      users: { data: dbUser, error: null },
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const result = await loginUser({ email: 'checho@example.com', password: 'correcta1' })

    expect(result.token).toBe('fake-jwt-token')
    expect(result.user).not.toHaveProperty('password')
    expect(result.user.email).toBe('checho@example.com')
  })

  it('rechaza con "Contraseña incorrecta" si bcrypt.compare devuelve false', async () => {
    ;(supabase.from as jest.Mock) = createFromMock({
      users: { data: dbUser, error: null },
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    await expect(
      loginUser({ email: 'checho@example.com', password: 'incorrecta' })
    ).rejects.toThrow('Contraseña incorrecta')
  })

  it('rechaza con "Usuario no encontrado" si el correo no existe', async () => {
    ;(supabase.from as jest.Mock) = createFromMock({
      users: { data: null, error: null },
    })

    await expect(
      loginUser({ email: 'no-existe@example.com', password: 'cualquiera' })
    ).rejects.toThrow('Usuario no encontrado')
  })

  it('propaga el error de Supabase si la consulta falla', async () => {
    ;(supabase.from as jest.Mock) = createFromMock({
      users: { data: null, error: { message: 'Error de conexión' } },
    })

    await expect(
      loginUser({ email: 'checho@example.com', password: 'cualquiera' })
    ).rejects.toThrow('Error de conexión')
  })
})
