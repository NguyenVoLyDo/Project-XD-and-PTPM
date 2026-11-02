import React from 'react';
import '@/styles/globals.css';
import { AuthProvider } from '@/features/auth/hooks/use-auth';

export const metadata = {
  title: 'DropConnect — Domestic Dropshipping Platform',
  description: 'Nền tảng Dropshipping kết nối Supplier, Seller và Customer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
