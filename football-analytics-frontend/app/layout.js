import './globals.css';
import AppShell from '@/components/AppShell';
import AuthSessionProvider from '@/components/AuthSessionProvider';

export const metadata = {
  title: 'ApexMatch — Quantitative Football Analytics',
  description: 'Pronósticos cuantitativos, value betting y gestión de bankroll con Criterio de Kelly.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen font-sans antialiased">
        <AuthSessionProvider>
          <AppShell>{children}</AppShell>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
