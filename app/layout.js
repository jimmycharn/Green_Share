import './globals.css';
import ClientLayout from '@/components/ClientLayout';
import { UserProvider } from '@/contexts/UserContext';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'GreenShare - ระบบจัดการวงแชร์พรีเมียม',
  description: 'จัดการวงแชร์ของคุณให้เป็นเรื่องง่ายและสวยงาม',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </head>
      <body>
        <UserProvider>
          <ClientLayout>{children}</ClientLayout>
        </UserProvider>
        <Toaster />
      </body>
    </html>
  );
}
