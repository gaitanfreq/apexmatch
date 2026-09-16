import './globals.css';
import AppShell from '@/components/AppShell';
import AuthSessionProvider from '@/components/AuthSessionProvider';
import LanguageProvider from '@/components/i18n/LanguageProvider';

export const metadata = {
  title: 'ApexMatch — Quantitative Football Analytics',
  description: 'Pronósticos cuantitativos, value betting y gestión de bankroll con Criterio de Kelly.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen font-sans antialiased">
        <LanguageProvider>
          <AuthSessionProvider>
            <AppShell>{children}</AppShell>
          </AuthSessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
