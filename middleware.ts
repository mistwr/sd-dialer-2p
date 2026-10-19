import { NextResponse, type NextRequest } from 'next/server'

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    /^sb-.+-auth-token(?:\.\d+)?$/.test(name)
  )
}

export function middleware(request: NextRequest) {
  // This is a fast navigation hint only. API routes and Supabase RLS still
  // validate the session before returning protected data.
  const isSignedIn = hasSessionCookie(request)
  const { pathname } = request.nextUrl

  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = isSignedIn ? '/admin' : '/login'
    return NextResponse.redirect(url)
  }

  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/supervisor') || pathname.startsWith('/parceiro')
  const isAuthPage = pathname === '/login'

  if (isProtected && !isSignedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthPage && isSignedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest\\.json).*)'],
}
