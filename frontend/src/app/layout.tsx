import './globals.css'
import Providers from './providers'

export const metadata = {
  title: 'SIGSEV',
  description: 'Sistema Inteligente de Gestión de Señalización Vial',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
