const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

type FetchOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
  auth?: boolean // default true — attach Bearer token
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { auth = true, headers = {}, ...rest } = options

  const token = getToken()
  const authHeader: Record<string, string> =
    auth && token ? { Authorization: `Bearer ${token}` } : {}

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...headers,
    },
    ...rest,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.message ?? `Error ${res.status}`)
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
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}
