'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { saveSeason } from '../actions';
import { FormScreen, checkTextClass, errorClass, fieldClass, labelClass } from '../form-screen';

export function SeasonForm({ seasonId }: { seasonId?: string }) {
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const [loading, setLoading] = useState(Boolean(seasonId));
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: false,
  });

  useEffect(() => {
    if (!seasonId) return;
    let cancelled = false;

    async function load() {
      const { data, error: loadError } = await supabase.from('seasons').select('*').eq('id', seasonId).single();
      if (cancelled) return;
      if (loadError || !data) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setFormData({
        name: data.name,
        start_date: String(data.start_date).slice(0, 10),
        end_date: String(data.end_date).slice(0, 10),
        is_active: data.is_active,
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await saveSeason({ ...formData, id: seasonId });
    setSaving(false);
    if (result.error || !result.id) {
      setError(result.error || 'Could not save the season');
      return;
    }
    router.push(seasonId ? '/admin/seasons' : `/admin/seasons/${result.id}`);
  }

  const title = seasonId ? t('trke_season_edit', 'Edit season') : t('trke_season_new', 'New season');

  return (
    <FormScreen title={title} backHref="/admin/seasons" backLabel={t('trke_back', 'Back')}>
      {loading ? (
        <p>{t('trke_loading', 'Loading...')}</p>
      ) : missing ? (
        <p>{t('trke_not_found', 'This page does not exist')}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className={errorClass}>{error}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>{t('trke_season_name', 'Name')} *</label>
              <input required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_season_start', 'Start date')} *</label>
              <input required type="date" value={formData.start_date} onChange={(event) => setFormData({ ...formData, start_date: event.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_season_end', 'End date')} *</label>
              <input required type="date" value={formData.end_date} onChange={(event) => setFormData({ ...formData, end_date: event.target.value })} className={fieldClass} />
            </div>
            <div className="flex items-center">
              <label className="flex items-center">
                <input type="checkbox" checked={formData.is_active} onChange={(event) => setFormData({ ...formData, is_active: event.target.checked })} className="mr-2" />
                <span className={checkTextClass}>{t('trke_season_active', 'Set as active')}</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50">
              {seasonId ? t('trke_update', 'Update') : t('trke_create', 'Create')}
            </button>
            <button type="button" onClick={() => router.push('/admin/seasons')} className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700">
              {t('trke_cancel', 'Cancel')}
            </button>
          </div>
        </form>
      )}
    </FormScreen>
  );
}
