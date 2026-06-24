const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

type FetchOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
  auth?: boolean // default true — attach Bearer token
}

// Error enriquecido con el body completo de la respuesta (útil para
// endpoints que devuelven detalle estructurado, p.ej. errores por fila
// en la carga masiva: { message, errors: [{ row, message }] }).
export class ApiError extends Error {
  details: unknown
  constructor(message: string, details: unknown) {
    super(message)
    this.details = details
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { auth = true, headers = {}, ...rest } = options

  const token = getToken()
  const authHeader: Record<string, string> =
    auth && token ? { Authorization: `Bearer ${token}` } : {}

  // Para FormData dejamos que el navegador fije el Content-Type (con boundary)
  const isFormData = typeof FormData !== 'undefined' && rest.body instanceof FormData

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader,
      ...headers,
    },
    ...rest,
  })

  const data = await res.json()

  if (!res.ok) {
    // Si la llamada llevaba un token y el backend la rechazó con 401, la sesión
    // expiró o el usuario fue desactivado. Limpiamos todo y mandamos a /login
    // con un mensaje claro en vez de dejar cada página mostrando un error genérico.
    if (res.status === 401 && auth && token && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      document.cookie = 'token=; path=/; max-age=0'
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1'
      }
    }
    throw new ApiError(data.message ?? `Error ${res.status}`, data)
  }

  return data as T
}

// Convenience helpers
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown, auth = true) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), auth }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  postForm: <T>(path: string, formData: FormData) =>
    apiFetch<T>(path, { method: 'POST', body: formData }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}
