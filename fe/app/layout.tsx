import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { ClientProvider } from './providers';

const interSans = Inter({
  variable: '--font-google-sans-fallback',
  subsets: ['latin'],
});

const robotoMono = Roboto_Mono({
  variable: '--font-google-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ChatSmile',
  description: 'Real-time chat application',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interSans.variable} ${robotoMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-violet-50 dark:bg-slate-950" suppressHydrationWarning>
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}
