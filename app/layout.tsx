import type {Metadata} from 'next';
import { Inter, Lexend, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const lexend = Lexend({ subsets: ['latin'], variable: '--font-lexend' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'Gajhedes Træning',
  description: 'Ingen undskyldning, bare igang',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="da" className={`dark h-full ${inter.variable} ${lexend.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-[#0A0C10] text-white font-sans antialiased selection:bg-orange-500 selection:text-white min-h-screen relative flex flex-col overflow-x-hidden" suppressHydrationWarning>
        {/* Background glow orbs */}
        <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px] md:blur-[120px] pointer-events-none -z-10"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/20 rounded-full blur-[80px] md:blur-[100px] pointer-events-none -z-10"></div>
        
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
