'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ClubLogo } from '@/components/ClubLogo';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { removeClubLogo, saveClub, uploadClubLogo } from '../actions';
import { FormScreen, errorClass, fieldClass, hintClass, labelClass } from '../form-screen';

export function ClubForm({ clubId }: { clubId?: string }) {
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(Boolean(clubId));
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    primary_color: '#1e40af',
    secondary_color: '#f97316',
  });

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    async function load() {
      const { data, error: loadError } = await supabase.from('clubs').select('*').eq('id', clubId).single();
      if (cancelled) return;
      if (loadError || !data) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setFormData({
        name: data.name,
        short_name: data.short_name || '',
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
      });
      setLogoUrl(data.logo_url);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await saveClub({ ...formData, id: clubId });
    setSaving(false);
    if (result.error || !result.id) {
      setError(result.error || 'Could not save the club');
      return;
    }
    if (clubId) {
      router.push('/admin/clubs');
      return;
    }
    router.push(`/admin/clubs/${result.id}`);
  }

  async function handleLogoUpload(file: File) {
    if (!clubId) return;
    setUploadingLogo(true);
    setError('');
    const result = await uploadClubLogo(clubId, file);
    setUploadingLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.url) setLogoUrl(result.url);
  }

  async function handleLogoRemove() {
    if (!clubId) return;
    if (!confirm(t('trke_club_logo_remove_confirm', 'Are you sure you want to remove this logo?'))) return;
    setError('');
    const result = await removeClubLogo(clubId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLogoUrl(null);
  }

  const title = clubId
    ? t('trke_club_edit', 'Edit club')
    : t('trke_club_new', 'New club');

  return (
    <FormScreen title={title} backHref="/admin/clubs" backLabel={t('trke_back', 'Back')}>
      {loading ? (
        <p>{t('trke_loading', 'Loading...')}</p>
      ) : missing ? (
        <p>{t('trke_not_found', 'This page does not exist')}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className={errorClass}>{error}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>{t('trke_club_name', 'Club name')} *</label>
              <input required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_club_short_name', 'Short name')}</label>
              <input maxLength={10} value={formData.short_name} onChange={(event) => setFormData({ ...formData, short_name: event.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_club_primary_color', 'Primary color')}</label>
              <input type="color" value={formData.primary_color} onChange={(event) => setFormData({ ...formData, primary_color: event.target.value })} className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700" />
            </div>
            <div>
              <label className={labelClass}>{t('trke_club_secondary_color', 'Secondary color')}</label>
              <input type="color" value={formData.secondary_color} onChange={(event) => setFormData({ ...formData, secondary_color: event.target.value })} className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700" />
            </div>
          </div>
          {clubId && (
            <div className="mt-4">
              <label className={labelClass}>{t('trke_club_logo', 'Logo')}</label>
              <div className="flex items-center gap-4">
                <ClubLogo logoUrl={logoUrl} clubName={formData.name || 'Club'} size="lg" />
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} className="rounded bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">
                    {uploadingLogo ? t('trke_loading', 'Loading...') : logoUrl ? t('trke_club_change_logo', 'Change logo') : t('trke_club_add_logo', 'Add logo')}
                  </button>
                  {logoUrl && (
                    <button type="button" onClick={handleLogoRemove} className="rounded bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-700">
                      {t('trke_club_remove_logo', 'Remove logo')}
                    </button>
                  )}
                  <p className={hintClass}>{t('trke_club_logo_hint', 'PNG, JPG, WebP or SVG, max 5MB')}</p>
                </div>
              </div>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50">
              {clubId ? t('trke_update', 'Update') : t('trke_create', 'Create')}
            </button>
            <button type="button" onClick={() => router.push('/admin/clubs')} className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700">
              {t('trke_cancel', 'Cancel')}
            </button>
          </div>
        </form>
      )}
    </FormScreen>
  );
}
