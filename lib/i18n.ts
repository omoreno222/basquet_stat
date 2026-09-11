import { supabase } from './supabase';
import { Locale } from '@/types/database';

const translationsCache: Record<Locale, Record<string, string>> = {
  en: {},
  es: {},
  ca: {},
};

let cacheLoaded = false;

export async function loadTranslations() {
  if (cacheLoaded) return;

  const { data } = await supabase.from('translations').select('*');
  
  if (data) {
    data.forEach((translation) => {
      translationsCache[translation.locale as Locale][translation.key] = translation.value;
    });
    cacheLoaded = true;
  }
}

export function t(key: string, locale: Locale = 'en'): string {
  return translationsCache[locale][key] || key;
}

export async function getTranslation(key: string, locale: Locale = 'en'): Promise<string> {
  await loadTranslations();
  return t(key, locale);
}
