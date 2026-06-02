import { NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const PROTECTED_PREFIXES = ['/dashboard']
// Routes only accessible when NOT logged in
const AUTH_ROUTES = ['/login', '/register']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('token')?.value

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  // Redirect unauthenticated users away from protected routes
  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Redirect authenticated users away from login/register
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
}
