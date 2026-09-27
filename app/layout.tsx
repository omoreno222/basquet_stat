import type { Metadata } from 'next';
import { Manrope, Sora } from 'next/font/google';
import './globals.css';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { Footer } from '@/components/Footer';
import packageJson from '../package.json';

const sora = Sora({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-sora',
});

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'SeasonMath',
  description: 'Basketball Statistics Management',
};

async function getTheme(): Promise<'light' | 'dark'> {
  const cookieStore = await cookies();
  
  // Try to get theme from auth token
  const token = cookieStore.get('sb-access-token')?.value;
  
  if (token) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme')
          .eq('id', user.id)
          .single();

        if (profile?.theme) {
          return profile.theme as 'light' | 'dark';
        }
      }
    } catch {
      // Fallback to cookie or default (ignore auth errors)
    }
  }

  // Fallback to theme cookie or default light
  const themeCookie = cookieStore.get('theme')?.value;
  return (themeCookie === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getTheme();
  
  // Get translations for footer
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const { data: translationsData } = await supabase
    .from('translations')
    .select('key, value')
    .eq('locale', 'en');
  
  const translations = translationsData?.reduce((acc: Record<string, string>, t) => {
    acc[t.key] = t.value;
    return acc;
  }, {}) || {};

  return (
    <html lang="en" className={`${theme} ${sora.variable} ${manrope.variable}`}>
      <body className="font-sans antialiased flex flex-col min-h-screen">
        <div className="flex-grow">
          {children}
        </div>
        <Footer translations={translations} version={packageJson.version} />
      </body>
    </html>
  );
}
