import type { Metadata } from 'next';
import './globals.css';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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
    } catch (error) {
      // Fallback to cookie or default
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
  
  return (
    <html lang="en" className={theme}>
      <body>{children}</body>
    </html>
  );
}
