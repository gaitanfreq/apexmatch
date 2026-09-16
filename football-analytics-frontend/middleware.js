import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/**
 * Protege las secciones privadas: sin sesión válida, NextAuth redirige a
 * /login (ver `callbacks.authorized` abajo). /admin además exige role='admin'
 * — cualquier otro usuario autenticado que intente entrar se redirige a '/'.
 *
 * Bankroll Tracker ahora guarda datos propios de cada usuario (bankroll
 * inicial, unidad de stake, historial de apuestas — ver
 * football-analytics-backend/src/api/routes/bankroll.js) por lo que también
 * requiere sesión. Dashboard y Live Predictions se dejan fuera del matcher a
 * propósito: son la Sección Gratuita pública del freemium.
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (pathname.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: ['/vip/:path*', '/settings/:path*', '/admin/:path*', '/bankroll/:path*'],
};
