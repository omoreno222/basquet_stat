'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useLocaleTranslations() {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      let locale = 'en';

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('locale, language')
          .eq('id', user.id)
          .single();
        locale = profile?.locale || profile?.language || 'en';
      }

      const { data } = await supabase
        .from('translations')
        .select('key, value')
        .eq('locale', locale);

      if (cancelled) return;

      const next: Record<string, string> = {};
      data?.forEach((row) => {
        next[row.key] = row.value;
      });
      setTranslations(next);
      setReady(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function t(key: string, fallback: string) {
    return translations[key] || fallback;
  }

  return { t, ready };
}
