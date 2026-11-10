import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LA Chat — Light Academy Secondary School',
  description:
    'Secure school communication platform for Light Academy Secondary School. A Different Approach to Education.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
