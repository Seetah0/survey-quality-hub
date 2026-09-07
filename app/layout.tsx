import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Survey Quality Hub | منصة جودة الاستبيانات',
  description:
    'تحليل استبيانات الجودة وتصدير التقارير — Survey analysis and reporting',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
