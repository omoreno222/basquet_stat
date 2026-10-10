-- Dismiss button on end-of-period notices: Spanish label is OK.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_notice_ok', 'es', 'OK')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
