import CredentialsProvider from 'next-auth/providers/credentials';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * NextAuth (Auth.js) con proveedor Credentials: la verificación real de
 * email+contraseña ocurre en el backend (`POST /api/auth/login`, bcrypt
 * contra `users.password_hash`) — este `authorize()` solo reenvía las
 * credenciales y adopta el resultado. El JWT que emite el backend
 * (`role`, `plan`) se guarda en el token de NextAuth como `backendToken`
 * para autenticar las llamadas a la API REST (ver lib/api.js).
 *
 * Roles: 'admin' (creador/superusuario, acceso total) | 'user' (free o vip
 * según `subscriptions.plan`, ver src/api/middleware/auth.js#hasFullAccess
 * en el backend).
 */
export const authOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });

        if (!res.ok) return null;
        const data = await res.json(); // { token, plan, role, email }

        return { id: data.email, email: data.email, role: data.role, plan: data.plan, backendToken: data.token };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.plan = user.plan;
        token.backendToken = user.backendToken;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.plan = token.plan;
      session.backendToken = token.backendToken;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
