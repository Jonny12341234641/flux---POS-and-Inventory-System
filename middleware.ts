import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { TABLES, USER_ROLE } from './src/lib/constants';

const LOGIN_PATH = '/auth/login';
const ADMIN_PATH = '/admin';
const POS_PATH = '/pos';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables.');
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';

  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRoot = pathname === '/';
  const isAdminRoute = pathname.startsWith(ADMIN_PATH);
  const isPosRoute = pathname.startsWith(POS_PATH);
  const isProtectedRoute = isAdminRoute || isPosRoute;

  if (!isRoot && !isProtectedRoute) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectWithCookies(request, response, LOGIN_PATH);
  }

  if (isRoot) {
    return redirectWithCookies(request, response, POS_PATH);
  }

  if (isAdminRoute) {
    const { data: profile, error: profileError } = await supabase
      .from(TABLES.USERS)
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || profile?.role !== USER_ROLE.ADMIN) {
      return redirectWithCookies(request, response, POS_PATH);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|api/auth).*)'],
};
