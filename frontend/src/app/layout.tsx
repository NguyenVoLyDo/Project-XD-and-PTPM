import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AuthProvider as IdentityAuthProvider } from '../features/auth/hooks/use-auth';
import { AuthProvider } from '../lib/auth-context';
import { Navbar } from '../components/navbar';
import { Footer } from '../components/footer';

const vietnam = localFont({
  src: [
    { path: '../../public/fonts/be-vietnam-pro-regular.ttf', weight: '400' },
    { path: '../../public/fonts/be-vietnam-pro-semibold.ttf', weight: '600' },
    { path: '../../public/fonts/be-vietnam-pro-bold.ttf', weight: '700' },
  ], display: 'swap',
});
export const metadata: Metadata = {
  title: { default: 'DropConnect — Tiện ích cho mỗi ngày', template: '%s | DropConnect' },
  description: 'Khám phá sản phẩm từ các gian hàng, mua sắm trong một giỏ hàng và theo dõi từng kiện giao đến bạn.',
};
export const viewport: Viewport = { themeColor: '#f5f7f5' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body className={vietnam.className + ' min-h-screen flex flex-col antialiased'}>
    <a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <IdentityAuthProvider><AuthProvider><Navbar /><main id="main-content" className="page-shell flex-1 py-8 sm:py-10 min-w-0">{children}</main><Footer /></AuthProvider></IdentityAuthProvider>
  </body></html>;
}
