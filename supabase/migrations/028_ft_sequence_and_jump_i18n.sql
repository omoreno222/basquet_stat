-- Labels for the free-throw sequence and the jump-ball popup.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_ft_sequence_title', 'en', 'Free throws'),
  ('trke_ft_sequence_title', 'es', 'Tiros libres'),
  ('trke_ft_sequence_title', 'ca', 'Tirs lliures'),

  ('trke_ft_sequence_hint', 'en', 'Personal foul · choose how many and mark each one'),
  ('trke_ft_sequence_hint', 'es', 'Falta personal · elige cuántos y marca cada uno'),
  ('trke_ft_sequence_hint', 'ca', 'Falta personal · tria quants i marca cadascun'),

  ('trke_ft_sequence_count', 'en', 'Number of shots'),
  ('trke_ft_sequence_count', 'es', 'Número de tiros'),
  ('trke_ft_sequence_count', 'ca', 'Nombre de tirs'),

  ('trke_ft_sequence_made', 'en', 'Made'),
  ('trke_ft_sequence_made', 'es', 'Anotado'),
  ('trke_ft_sequence_made', 'ca', 'Anotat'),

  ('trke_ft_sequence_miss', 'en', 'Miss'),
  ('trke_ft_sequence_miss', 'es', 'Fallo'),
  ('trke_ft_sequence_miss', 'ca', 'Fallada'),

  ('trke_ft_sequence_done', 'en', 'Done'),
  ('trke_ft_sequence_done', 'es', 'Listo'),
  ('trke_ft_sequence_done', 'ca', 'Fet'),

  ('trke_jump_button', 'en', 'Jump ball'),
  ('trke_jump_button', 'es', 'Salto'),
  ('trke_jump_button', 'ca', 'Salt'),

  ('trke_jump_title', 'en', 'Jump ball'),
  ('trke_jump_title', 'es', 'Salto'),
  ('trke_jump_title', 'ca', 'Salt'),

  ('trke_jump_hint', 'en', 'Start the clock before marking the tip'),
  ('trke_jump_hint', 'es', 'Arranca el reloj antes de marcar el salto'),
  ('trke_jump_hint', 'ca', 'Engega el rellotge abans de marcar el salt'),

  ('trke_jump_start_clock', 'en', 'Start clock'),
  ('trke_jump_start_clock', 'es', 'Arrancar reloj'),
  ('trke_jump_start_clock', 'ca', 'Engegar rellotge'),

  ('trke_jump_clock_on', 'en', 'Clock running'),
  ('trke_jump_clock_on', 'es', 'Reloj en marcha'),
  ('trke_jump_clock_on', 'ca', 'Rellotge en marxa'),

  ('trke_jump_winner', 'en', 'Who wins the tip?'),
  ('trke_jump_winner', 'es', '¿Quién gana el salto?'),
  ('trke_jump_winner', 'ca', 'Qui guanya el salt?'),

  ('trke_jump_done', 'en', 'Done'),
  ('trke_jump_done', 'es', 'Listo'),
  ('trke_jump_done', 'ca', 'Fet')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
