'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { api } from '@/lib/api'

interface AuthUser {
  id: string
  full_name: string
  email: string
  role_id: string | null
  roles: {
    id: string
    name: string
    description: string | null
  } | null
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from localStorage on first render
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }

    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: AuthUser }>(
      '/api/auth/login',
      { email, password },
      false // no auth header needed for login
    )

    // Store in both localStorage (for client reads) and cookie (for middleware)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24}; SameSite=Strict`
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    document.cookie = 'token=; path=/; max-age=0'
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
