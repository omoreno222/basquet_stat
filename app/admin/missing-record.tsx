'use client';

import { FormScreen } from './form-screen';
import { useLocaleTranslations } from '@/lib/use-locale-translations';

export function MissingRecord({ backHref }: { backHref: string }) {
  const { t } = useLocaleTranslations();
  const message = t('trke_not_found', 'This page does not exist');
  return (
    <FormScreen title={message} backHref={backHref} backLabel={t('trke_back', 'Back')}>
      <p>{message}</p>
    </FormScreen>
  );
}
