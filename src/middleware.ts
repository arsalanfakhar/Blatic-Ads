import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware';

const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/refresh', '/login', '/favicon.ico', '/api/cron'];

function isPublic(path: string): boolean {
  if (path === '/' || path.startsWith('/_next') || (path.includes('.') && !path.endsWith('.html'))) return true;
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const response = NextResponse.next({ request });
  const supabase = createSupabaseMiddlewareClient(request, response);

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
