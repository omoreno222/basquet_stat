-- Migration 007: Add i18n translations for Realtime sync features
-- Adds translation keys for connection status and clock authority indicators

-- Insert new translations with upsert to avoid conflicts
INSERT INTO translations (key, locale, value)
VALUES
  -- Connection status
  ('trke_capture_connected', 'en', 'Connected'),
  ('trke_capture_connected', 'es', 'Conectado'),
  ('trke_capture_connected', 'ca', 'Connectat'),
  
  ('trke_capture_reconnecting', 'en', 'Reconnecting...'),
  ('trke_capture_reconnecting', 'es', 'Reconectando...'),
  ('trke_capture_reconnecting', 'ca', 'Reconnectant...'),
  
  ('trke_capture_offline', 'en', 'Offline'),
  ('trke_capture_offline', 'es', 'Desconectado'),
  ('trke_capture_offline', 'ca', 'Desconnectat'),
  
  ('trke_capture_online_count', 'en', 'online'),
  ('trke_capture_online_count', 'es', 'en línea'),
  ('trke_capture_online_count', 'ca', 'en línia'),
  
  -- Clock authority
  ('trke_capture_clock_authority', 'en', 'Clock Authority'),
  ('trke_capture_clock_authority', 'es', 'Autoridad del Reloj'),
  ('trke_capture_clock_authority', 'ca', 'Autoritat del Rellotge'),
  
  ('trke_capture_view_only', 'en', 'View Only'),
  ('trke_capture_view_only', 'es', 'Solo Vista'),
  ('trke_capture_view_only', 'ca', 'Només Vista'),
  
  -- Period controls
  ('trke_capture_next_period', 'en', 'Next Period'),
  ('trke_capture_next_period', 'es', 'Siguiente Período'),
  ('trke_capture_next_period', 'ca', 'Següent Període'),
  
  ('trke_capture_switch_possession', 'en', 'Switch'),
  ('trke_capture_switch_possession', 'es', 'Cambiar'),
  ('trke_capture_switch_possession', 'ca', 'Canviar'),
  
  -- Action buttons
  ('trke_capture_record_shot', 'en', 'Record Shot'),
  ('trke_capture_record_shot', 'es', 'Registrar Tiro'),
  ('trke_capture_record_shot', 'ca', 'Registrar Tir'),
  
  ('trke_capture_other_actions', 'en', 'Other Actions'),
  ('trke_capture_other_actions', 'es', 'Otras Acciones'),
  ('trke_capture_other_actions', 'ca', 'Altres Accions'),
  
  ('trke_capture_quick_actions', 'en', 'Quick Actions'),
  ('trke_capture_quick_actions', 'es', 'Acciones Rápidas'),
  ('trke_capture_quick_actions', 'ca', 'Accions Ràpides'),
  
  -- Rebound and assist prompts
  ('trke_capture_rebound_question', 'en', 'Rebound?'),
  ('trke_capture_rebound_question', 'es', '¿Rebote?'),
  ('trke_capture_rebound_question', 'ca', 'Rebot?'),
  
  ('trke_capture_opponent_rebound', 'en', 'Opponent Rebound'),
  ('trke_capture_opponent_rebound', 'es', 'Rebote Rival'),
  ('trke_capture_opponent_rebound', 'ca', 'Rebot Rival'),
  
  ('trke_capture_assist_question', 'en', 'Assist?'),
  ('trke_capture_assist_question', 'es', '¿Asistencia?'),
  ('trke_capture_assist_question', 'ca', 'Assistència?'),
  
  ('trke_capture_no_assist', 'en', 'No Assist'),
  ('trke_capture_no_assist', 'es', 'Sin Asistencia'),
  ('trke_capture_no_assist', 'ca', 'Sense Assistència'),
  
  -- Court and shot location
  ('trke_capture_tap_location', 'en', 'Tap where shot was taken'),
  ('trke_capture_tap_location', 'es', 'Toca donde se realizó el tiro'),
  ('trke_capture_tap_location', 'ca', 'Toca on es va fer el tir'),
  
  ('trke_capture_half_court', 'en', 'Half Court'),
  ('trke_capture_half_court', 'es', 'Media Cancha'),
  ('trke_capture_half_court', 'ca', 'Mitja Pista'),
  
  -- Errors and prompts
  ('trke_capture_select_player_first', 'en', 'Please select a player first'),
  ('trke_capture_select_player_first', 'es', 'Por favor selecciona un jugador primero'),
  ('trke_capture_select_player_first', 'ca', 'Si us plau selecciona un jugador primer'),
  
  ('trke_capture_period_ended', 'en', 'Period {period} ended'),
  ('trke_capture_period_ended', 'es', 'Período {period} finalizado'),
  ('trke_capture_period_ended', 'ca', 'Període {period} finalitzat'),
  
  ('trke_capture_undo_other_user', 'en', 'This event was recorded by another user. Undo anyway?'),
  ('trke_capture_undo_other_user', 'es', 'Este evento fue registrado por otro usuario. ¿Deshacer de todos modos?'),
  ('trke_capture_undo_other_user', 'ca', 'Aquest esdeveniment va ser registrat per un altre usuari. Desfer igualment?'),
  
  ('trke_capture_not_assigned', 'en', 'You are not assigned to this game.'),
  ('trke_capture_not_assigned', 'es', 'No estás asignado a este partido.'),
  ('trke_capture_not_assigned', 'ca', 'No estàs assignat a aquest partit.'),
  
  ('trke_capture_go_to_management', 'en', 'Go to game management'),
  ('trke_capture_go_to_management', 'es', 'Ir a gestión del partido'),
  ('trke_capture_go_to_management', 'ca', 'Anar a gestió del partit')

ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
