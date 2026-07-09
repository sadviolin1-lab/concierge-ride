import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: {
    default: 'Concierge Ride',
    template: '%s | Concierge Ride',
  },
  description:
    'Concierge department staff shuttle and logistics management platform.',
  keywords: ['concierge', 'shuttle', 'staff transport', 'logistics'],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
