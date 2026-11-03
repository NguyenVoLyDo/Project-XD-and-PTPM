import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AuthProvider as IdentityAuthProvider } from '../features/auth/hooks/use-auth';
import { AuthProvider } from '../lib/auth-context';
import { AppShell } from '../components/layout/app-shell';

const inter = localFont({
  src: [
    { path: '../../public/fonts/inter-regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/inter-semibold.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/inter-bold.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: { default: 'DropConnect — Nền tảng Dropshipping B2B2C Nội Địa', template: '%s | DropConnect' },
  description: 'Khám phá sản phẩm từ các gian hàng, mua sắm trong một giỏ hàng và theo dõi từng kiện giao đến bạn.',
};

export const viewport: Viewport = { themeColor: '#0F172A' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className={inter.className + ' min-h-screen flex flex-col antialiased bg-canvas text-ink'}>
        <a href="#main-content" className="skip-link">Đến nội dung chính</a>
        <IdentityAuthProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </IdentityAuthProvider>
      </body>
    </html>
  );
}
