-- Carga a posteriori de la hoja MasterData.
-- Partido: Lestonnac 2013 Infantil (home) vs CB Ciutat Vella (away).
-- Juego: bd6f4442-4315-4a8c-b66f-22dd42af9d21
-- LES en la hoja es el equipo. CIB es el rival.
-- El reloj de la hoja está guardado como hora de Excel: 8:41:00 significa 8:41 del cuarto.
-- Salto ganado LES y salto perdido CIB son el mismo salto inicial: lo gana Lestonnac.
-- Personal recibida no se inserta: solo dice a quién hicieron la falta, y no es una falta de ese jugador.
-- En Q3, el tiro libre fallado de Erick trae el marcador 26-13. La canasta anterior deja 26-14 y la siguiente 26-16, así que ese 13 es un error de la hoja.
-- Dorsales corregidos por el nombre: Victor Aliguer (0 -> 53), Marc Verdiell (3 -> 6), Robert Tormos (1 -> 18).
-- La hoja no dice quién tiene el balón después de cada jugada. La posesión queda en Lestonnac, que ganó el salto.
-- El partido se deja en directo, con el reloj parado, para poder revisarlo. El marcador queda 31-43.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM game_events WHERE game_id = 'bd6f4442-4315-4a8c-b66f-22dd42af9d21') THEN
    RAISE EXCEPTION 'Este partido ya tiene eventos. No se ha insertado nada.';
  END IF;
END $$;

-- Cuarto 1. Primero el quinteto inicial, luego los eventos.
UPDATE games SET current_period = 1, clock_running = false, clock_remaining_ms = 600000 WHERE id = 'bd6f4442-4315-4a8c-b66f-22dd42af9d21';

INSERT INTO game_period_lineups (game_id, period_number, side, position_index, player_id, opponent_player_id) VALUES
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'home', 0, '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'home', 1, '9db67521-4658-400d-80cd-7d0fb965ceac', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'home', 2, '3beb7508-b322-480c-8313-a6eda611e3f2', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'home', 3, '53dd0f6c-5587-499c-bbba-c134289c3b9b', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'home', 4, '6e6f2ebe-eaf6-476f-9c9a-672840abec36', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'away', 0, NULL, 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'away', 1, NULL, 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'away', 2, NULL, 'e6150adb-3505-4cf6-86ce-edb35cabd2bd'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'away', 3, NULL, '7f34311a-4957-44ca-bf1e-c3c87e3369ee'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 1, 'away', 4, NULL, 'f3a7f33f-0f25-4977-bb40-57bd2ded0300');

-- Q1 10:00 Salto Ganado LES Pere Moreno
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, jump_side, jump_won, possession_before, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'jump', 1, 600000, 0, 0, 'home', true, NULL, timestamptz '2026-10-03 12:00:00+00' + interval '0 seconds');

-- Q1 8:41 Personal hecha LES Flavio Loffredo (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 1, 521000, 79000, 0, 'personal', 'home', 'no_shot', 0, 'dc36f527-4a47-40ba-928d-ca488ae3e4d9', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '1 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Q1 7:48 Personal hecha LES Thomas Quintino (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 1, 468000, 132000, 0, 'personal', 'home', 'no_shot', 0, 'fa046531-d0c7-43d8-a9ae-b52a4b359c8b', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '2 seconds', '9db67521-4658-400d-80cd-7d0fb965ceac');

-- Q1 7:48 Entra al camp LES Victor Aliguer (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 468000, 132000, 0, 'e5964335-cbb5-4368-b96b-de3f27e0b297', '9db67521-4658-400d-80cd-7d0fb965ceac', timestamptz '2026-10-03 12:00:00+00' + interval '3 seconds');

-- Q1 7:22 Personal hecha LES Martí Izquierdo (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 1, 442000, 158000, 0, 'personal', 'home', 'no_shot', 2, '89dc939a-c5ea-4a4a-9460-44192e010792', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '4 seconds', '3beb7508-b322-480c-8313-a6eda611e3f2');

-- Q1 7:22 Tiro libre fallado CIB Teo Liwei Tan
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 1, 442000, 158000, 0, false, '89dc939a-c5ea-4a4a-9460-44192e010792', timestamptz '2026-10-03 12:00:00+00' + interval '5 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Q1 7:22 Tiro libre fallado CIB Teo Liwei Tan
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 1, 442000, 158000, 0, false, '89dc939a-c5ea-4a4a-9460-44192e010792', timestamptz '2026-10-03 12:00:00+00' + interval '6 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Q1 6:00 Canasta de 2 puntos CIB Teo Liwei Tan
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 1, 360000, 240000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '7 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Q1 5:46 Tiempo muerto LES * NO APLICA *
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, timeout_side, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'timeout', 1, 346000, 254000, 0, 'home', timestamptz '2026-10-03 12:00:00+00' + interval '8 seconds');

-- Q1 5:46 Entra al camp LES Ibai Fraile (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 346000, 254000, 0, '8810aef1-8f00-43aa-ba83-45c7ca651c7b', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', timestamptz '2026-10-03 12:00:00+00' + interval '9 seconds');

-- Q1 4:56 Personal hecha CIB Martín Ortas (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 1, 296000, 304000, 0, 'personal', 'away', 'no_shot', 0, 'c7e4033d-c457-4733-bf2f-3fee268983d1', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '10 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Q1 4:48 Canasta de 2 puntos LES Pere Moreno
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 1, 288000, 312000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '11 seconds', '53dd0f6c-5587-499c-bbba-c134289c3b9b');

-- Q1 4:01 Entra al camp CIB Marçal Garcia (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 241000, 359000, 0, '8d96cbad-3285-46c7-9c7b-100d31652005', 'e6150adb-3505-4cf6-86ce-edb35cabd2bd', timestamptz '2026-10-03 12:00:00+00' + interval '12 seconds');

-- Q1 4:01 Entra al camp CIB Rayan Benzaina (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 241000, 359000, 0, 'bc8cff16-4884-422c-ac81-baa4223dfeb6', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0', timestamptz '2026-10-03 12:00:00+00' + interval '13 seconds');

-- Q1 4:01 Entra al camp LES Marc Verdiell (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 241000, 359000, 0, 'dafbc732-83a3-4572-8a9b-6919920978f2', '3beb7508-b322-480c-8313-a6eda611e3f2', timestamptz '2026-10-03 12:00:00+00' + interval '14 seconds');

-- Q1 3:46 Personal hecha LES Adrián Ibáñez (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 1, 226000, 374000, 0, 'personal', 'home', 'no_shot', 2, 'cb33c34f-a7c1-4765-9093-b57cc1c452fd', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '15 seconds', '6e6f2ebe-eaf6-476f-9c9a-672840abec36');

-- Q1 3:46 Fallo de 1 punto CIB Marçal Garcia
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 1, 226000, 374000, 0, false, 'cb33c34f-a7c1-4765-9093-b57cc1c452fd', timestamptz '2026-10-03 12:00:00+00' + interval '16 seconds', '8d96cbad-3285-46c7-9c7b-100d31652005');

-- Q1 3:46 Fallo de 1 punto CIB Marçal Garcia
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 1, 226000, 374000, 0, false, 'cb33c34f-a7c1-4765-9093-b57cc1c452fd', timestamptz '2026-10-03 12:00:00+00' + interval '17 seconds', '8d96cbad-3285-46c7-9c7b-100d31652005');

-- Q1 3:38 Entra al camp CIB David Martín (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 218000, 382000, 0, 'bdb9f9cc-67ee-407e-8a04-dc692e57964e', '7f34311a-4957-44ca-bf1e-c3c87e3369ee', timestamptz '2026-10-03 12:00:00+00' + interval '18 seconds');

-- Q1 3:38 Entra al camp LES Erick Dotta (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 218000, 382000, 0, '81b4886d-2ad5-4790-aa66-9b85adf3813c', '53dd0f6c-5587-499c-bbba-c134289c3b9b', timestamptz '2026-10-03 12:00:00+00' + interval '19 seconds');

-- Q1 3:28 Personal hecha CIB Rayan Benzaina (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 1, 208000, 392000, 0, 'personal', 'away', 'no_shot', 2, '50437bd9-1aa5-4906-9e5b-edd867be3e49', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '20 seconds', 'bc8cff16-4884-422c-ac81-baa4223dfeb6');

-- Q1 3:28 Fallo de 1 punto LES Ibai Fraile
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 1, 208000, 392000, 0, false, '50437bd9-1aa5-4906-9e5b-edd867be3e49', timestamptz '2026-10-03 12:00:00+00' + interval '21 seconds', '8810aef1-8f00-43aa-ba83-45c7ca651c7b');

-- Q1 3:28 Fallo de 1 punto LES Ibai Fraile
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 1, 208000, 392000, 0, false, '50437bd9-1aa5-4906-9e5b-edd867be3e49', timestamptz '2026-10-03 12:00:00+00' + interval '22 seconds', '8810aef1-8f00-43aa-ba83-45c7ca651c7b');

-- Q1 2:14 Canasta de 2 puntos CIB Rayan Benzaina
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 1, 134000, 466000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '23 seconds', 'bc8cff16-4884-422c-ac81-baa4223dfeb6');

-- Q1 1:42 Personal hecha CIB Teo Liwei Tan (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 1, 102000, 498000, 0, 'personal', 'away', 'no_shot', 0, 'b7ab1d55-e783-4b25-90e1-10c930a34b81', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '24 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Q1 1:42 Entra al camp CIB Ander Otaola (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 102000, 498000, 0, '307ad59e-d102-4504-9314-0c4d5b233dd3', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b', timestamptz '2026-10-03 12:00:00+00' + interval '25 seconds');

-- Q1 1:42 Entra al camp CIB Leo Lloansi (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 102000, 498000, 0, '6fbb4c7f-36fd-4b2a-8954-97d7f194c02c', 'f3a7f33f-0f25-4977-bb40-57bd2ded0300', timestamptz '2026-10-03 12:00:00+00' + interval '26 seconds');

-- Q1 0:59 Tiempo muerto CIB * NO APLICA *
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, timeout_side, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'timeout', 1, 59000, 541000, 0, 'away', timestamptz '2026-10-03 12:00:00+00' + interval '27 seconds');

-- Q1 0:59 Canasta de 2 puntos LES Adrián Ibáñez
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 1, 59000, 541000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '28 seconds', '6e6f2ebe-eaf6-476f-9c9a-672840abec36');

-- Q1 0:59 Entra al camp CIB Leonardo Dario (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 59000, 541000, 0, '33a33254-1c5f-4eea-9e35-264980f55b76', 'bc8cff16-4884-422c-ac81-baa4223dfeb6', timestamptz '2026-10-03 12:00:00+00' + interval '29 seconds');

-- Q1 0:59 Entra al camp LES Max Namuth (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 59000, 541000, 0, '6cb09a89-e482-4b72-a6a4-44bfccfe5007', '6e6f2ebe-eaf6-476f-9c9a-672840abec36', timestamptz '2026-10-03 12:00:00+00' + interval '30 seconds');

-- Q1 0:59 Entra al camp LES Flavio Loffredo (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 1, 59000, 541000, 0, '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', 'e5964335-cbb5-4368-b96b-de3f27e0b297', timestamptz '2026-10-03 12:00:00+00' + interval '31 seconds');

-- Q1 0:10 Personal hecha LES Flavio Loffredo (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 1, 10000, 590000, 0, 'personal', 'home', 'no_shot', 0, '13923943-8bbb-4a9e-b52b-a65d3ca0ae02', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '32 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Cuarto 2. Primero el quinteto inicial, luego los eventos.
UPDATE games SET current_period = 2, clock_running = false, clock_remaining_ms = 600000 WHERE id = 'bd6f4442-4315-4a8c-b66f-22dd42af9d21';

INSERT INTO game_period_lineups (game_id, period_number, side, position_index, player_id, opponent_player_id) VALUES
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'home', 0, 'dafbc732-83a3-4572-8a9b-6919920978f2', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'home', 1, '81b4886d-2ad5-4790-aa66-9b85adf3813c', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'home', 2, '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'home', 3, '8810aef1-8f00-43aa-ba83-45c7ca651c7b', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'home', 4, '6cb09a89-e482-4b72-a6a4-44bfccfe5007', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'away', 0, NULL, '6fbb4c7f-36fd-4b2a-8954-97d7f194c02c'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'away', 1, NULL, '33a33254-1c5f-4eea-9e35-264980f55b76'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'away', 2, NULL, 'bdb9f9cc-67ee-407e-8a04-dc692e57964e'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'away', 3, NULL, '307ad59e-d102-4504-9314-0c4d5b233dd3'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 2, 'away', 4, NULL, '8d96cbad-3285-46c7-9c7b-100d31652005');

-- Q2 10:00 Entra al camp LES Pere Moreno (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 600000, 0, 0, '53dd0f6c-5587-499c-bbba-c134289c3b9b', 'dafbc732-83a3-4572-8a9b-6919920978f2', timestamptz '2026-10-03 12:00:00+00' + interval '33 seconds');

-- Q2 10:00 Entra al camp LES Martí Izquierdo (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 600000, 0, 0, '3beb7508-b322-480c-8313-a6eda611e3f2', '81b4886d-2ad5-4790-aa66-9b85adf3813c', timestamptz '2026-10-03 12:00:00+00' + interval '34 seconds');

-- Q2 9:45 Canasta de 2 puntos LES Flavio Loffredo
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 585000, 15000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '35 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Q2 9:26 Canasta de 2 puntos LES Flavio Loffredo
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 566000, 34000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '36 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Q2 8:36 Entra al camp CIB Robert Tormos (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 516000, 84000, 0, '63dcd6da-aca4-4ebe-9459-1404fd7ef9d4', '6fbb4c7f-36fd-4b2a-8954-97d7f194c02c', timestamptz '2026-10-03 12:00:00+00' + interval '37 seconds');

-- Q2 8:30 Personal hecha LES Flavio Loffredo (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 2, 510000, 90000, 0, 'personal', 'home', 'no_shot', 0, '18a18e8c-606a-4698-98ce-4a0244011a14', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '38 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Q2 8:30 Entra al camp LES Adrián Ibáñez (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 510000, 90000, 0, '6e6f2ebe-eaf6-476f-9c9a-672840abec36', '8810aef1-8f00-43aa-ba83-45c7ca651c7b', timestamptz '2026-10-03 12:00:00+00' + interval '39 seconds');

-- Q2 8:30 Entra al camp LES Thomas Quintino (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 510000, 90000, 0, '9db67521-4658-400d-80cd-7d0fb965ceac', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', timestamptz '2026-10-03 12:00:00+00' + interval '40 seconds');

-- Q2 7:51 Entra al camp LES Ibai Fraile (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 471000, 129000, 0, '8810aef1-8f00-43aa-ba83-45c7ca651c7b', '6cb09a89-e482-4b72-a6a4-44bfccfe5007', timestamptz '2026-10-03 12:00:00+00' + interval '41 seconds');

-- Q2 7:34 Canasta de 2 puntos CIB Leonardo Dario
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 454000, 146000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '42 seconds', '33a33254-1c5f-4eea-9e35-264980f55b76');

-- Q2 6:46 Canasta de 2 puntos CIB Leonardo Dario
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 406000, 194000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '43 seconds', '33a33254-1c5f-4eea-9e35-264980f55b76');

-- Q2 6:41 Entra al camp CIB Martín Ortas (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 401000, 199000, 0, 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0', 'bdb9f9cc-67ee-407e-8a04-dc692e57964e', timestamptz '2026-10-03 12:00:00+00' + interval '44 seconds');

-- Q2 6:17 Personal hecha CIB Ander Otaola (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 2, 377000, 223000, 0, 'personal', 'away', 'no_shot', 0, '87179b25-498b-47b8-a1be-f040030dce54', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '45 seconds', '307ad59e-d102-4504-9314-0c4d5b233dd3');

-- Q2 6:11 Canasta de 2 puntos LES Pere Moreno
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 371000, 229000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '46 seconds', '53dd0f6c-5587-499c-bbba-c134289c3b9b');

-- Q2 5:31 Canasta de 2 puntos CIB Martín Ortas
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 331000, 269000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '47 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Q2 5:16 Entra al camp CIB Teo Liwei Tan (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 316000, 284000, 0, 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b', '33a33254-1c5f-4eea-9e35-264980f55b76', timestamptz '2026-10-03 12:00:00+00' + interval '48 seconds');

-- Q2 5:16 Entra al camp LES Victor Aliguer (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 316000, 284000, 0, 'e5964335-cbb5-4368-b96b-de3f27e0b297', '53dd0f6c-5587-499c-bbba-c134289c3b9b', timestamptz '2026-10-03 12:00:00+00' + interval '49 seconds');

-- Q2 5:16 Entra al camp LES Marc Verdiell (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 316000, 284000, 0, 'dafbc732-83a3-4572-8a9b-6919920978f2', '8810aef1-8f00-43aa-ba83-45c7ca651c7b', timestamptz '2026-10-03 12:00:00+00' + interval '50 seconds');

-- Q2 3:38 Entra al camp CIB Rayan Benzaina (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 218000, 382000, 0, 'bc8cff16-4884-422c-ac81-baa4223dfeb6', '307ad59e-d102-4504-9314-0c4d5b233dd3', timestamptz '2026-10-03 12:00:00+00' + interval '51 seconds');

-- Q2 3:11 Canasta de 2 puntos CIB Teo Liwei Tan
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 191000, 409000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '52 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Q2 2:26 Entra al camp CIB Pol Torres Capellades (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 146000, 454000, 0, 'e6150adb-3505-4cf6-86ce-edb35cabd2bd', '8d96cbad-3285-46c7-9c7b-100d31652005', timestamptz '2026-10-03 12:00:00+00' + interval '53 seconds');

-- Q2 2:26 Entra al camp CIB Jan Vilanova (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 146000, 454000, 0, 'f3a7f33f-0f25-4977-bb40-57bd2ded0300', '63dcd6da-aca4-4ebe-9459-1404fd7ef9d4', timestamptz '2026-10-03 12:00:00+00' + interval '54 seconds');

-- Q2 2:26 Entra al camp LES Erick Dotta (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 146000, 454000, 0, '81b4886d-2ad5-4790-aa66-9b85adf3813c', '3beb7508-b322-480c-8313-a6eda611e3f2', timestamptz '2026-10-03 12:00:00+00' + interval '55 seconds');

-- Q2 2:26 Entra al camp LES Ibai Fraile (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 146000, 454000, 0, '8810aef1-8f00-43aa-ba83-45c7ca651c7b', '9db67521-4658-400d-80cd-7d0fb965ceac', timestamptz '2026-10-03 12:00:00+00' + interval '56 seconds');

-- Q2 1:50 Canasta de 2 puntos CIB Jan Vilanova
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 110000, 490000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '57 seconds', 'f3a7f33f-0f25-4977-bb40-57bd2ded0300');

-- Q2 0:59 Entra al camp LES Pere Moreno (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 2, 59000, 541000, 0, '53dd0f6c-5587-499c-bbba-c134289c3b9b', 'dafbc732-83a3-4572-8a9b-6919920978f2', timestamptz '2026-10-03 12:00:00+00' + interval '58 seconds');

-- Q2 0:15 Canasta de 2 puntos CIB Martín Ortas
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 2, 15000, 585000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '59 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Cuarto 3. Primero el quinteto inicial, luego los eventos.
UPDATE games SET current_period = 3, clock_running = false, clock_remaining_ms = 600000 WHERE id = 'bd6f4442-4315-4a8c-b66f-22dd42af9d21';

INSERT INTO game_period_lineups (game_id, period_number, side, position_index, player_id, opponent_player_id) VALUES
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'home', 0, '53dd0f6c-5587-499c-bbba-c134289c3b9b', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'home', 1, '6e6f2ebe-eaf6-476f-9c9a-672840abec36', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'home', 2, 'e5964335-cbb5-4368-b96b-de3f27e0b297', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'home', 3, '8810aef1-8f00-43aa-ba83-45c7ca651c7b', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'home', 4, '81b4886d-2ad5-4790-aa66-9b85adf3813c', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'away', 0, NULL, 'e6150adb-3505-4cf6-86ce-edb35cabd2bd'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'away', 1, NULL, 'bc8cff16-4884-422c-ac81-baa4223dfeb6'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'away', 2, NULL, 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'away', 3, NULL, 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 3, 'away', 4, NULL, 'f3a7f33f-0f25-4977-bb40-57bd2ded0300');

-- Q3 10:00 Entra al camp CIB Marçal Garcia (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 600000, 0, 0, '8d96cbad-3285-46c7-9c7b-100d31652005', 'e6150adb-3505-4cf6-86ce-edb35cabd2bd', timestamptz '2026-10-03 12:00:00+00' + interval '60 seconds');

-- Q3 10:00 Entra al camp CIB Leonardo Dario (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 600000, 0, 0, '33a33254-1c5f-4eea-9e35-264980f55b76', 'bc8cff16-4884-422c-ac81-baa4223dfeb6', timestamptz '2026-10-03 12:00:00+00' + interval '61 seconds');

-- Q3 10:00 Entra al camp CIB Robert Tormos (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 600000, 0, 0, '63dcd6da-aca4-4ebe-9459-1404fd7ef9d4', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b', timestamptz '2026-10-03 12:00:00+00' + interval '62 seconds');

-- Q3 10:00 Entra al camp CIB Leo Lloansi (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 600000, 0, 0, '6fbb4c7f-36fd-4b2a-8954-97d7f194c02c', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0', timestamptz '2026-10-03 12:00:00+00' + interval '63 seconds');

-- Q3 10:00 Entra al camp CIB Joan Vidal (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 600000, 0, 0, '7f34311a-4957-44ca-bf1e-c3c87e3369ee', 'f3a7f33f-0f25-4977-bb40-57bd2ded0300', timestamptz '2026-10-03 12:00:00+00' + interval '64 seconds');

-- Q3 10:00 Entra al camp LES Max Namuth (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 600000, 0, 0, '6cb09a89-e482-4b72-a6a4-44bfccfe5007', '53dd0f6c-5587-499c-bbba-c134289c3b9b', timestamptz '2026-10-03 12:00:00+00' + interval '65 seconds');

-- Q3 10:00 Entra al camp LES Flavio Loffredo (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 600000, 0, 0, '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', '6e6f2ebe-eaf6-476f-9c9a-672840abec36', timestamptz '2026-10-03 12:00:00+00' + interval '66 seconds');

-- Q3 9:33 Canasta de 2 puntos CIB Joan Vidal
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 573000, 27000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '67 seconds', '7f34311a-4957-44ca-bf1e-c3c87e3369ee');

-- Q3 7:28 Canasta de 2 puntos CIB Joan Vidal
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 448000, 152000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '68 seconds', '7f34311a-4957-44ca-bf1e-c3c87e3369ee');

-- Q3 7:02 Canasta de 2 puntos CIB Marçal Garcia
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 422000, 178000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '69 seconds', '8d96cbad-3285-46c7-9c7b-100d31652005');

-- Q3 7:00 Tiempo muerto LES * NO APLICA *
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, timeout_side, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'timeout', 3, 420000, 180000, 0, 'home', timestamptz '2026-10-03 12:00:00+00' + interval '70 seconds');

-- Q3 7:00 Entra al camp LES Adrián Ibáñez (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 420000, 180000, 0, '6e6f2ebe-eaf6-476f-9c9a-672840abec36', '6cb09a89-e482-4b72-a6a4-44bfccfe5007', timestamptz '2026-10-03 12:00:00+00' + interval '71 seconds');

-- Q3 6:37 Personal hecha CIB Joan Vidal (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 3, 397000, 203000, 0, 'personal', 'away', 'no_shot', 0, '23d1d944-48ee-4e1d-8ec4-7eae2a38c658', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '72 seconds', '7f34311a-4957-44ca-bf1e-c3c87e3369ee');

-- Q3 6:32 Personal hecha CIB Robert Tormos (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 3, 392000, 208000, 0, 'personal', 'away', 'no_shot', 0, 'c83597bb-11c0-4193-9225-49890a10e56b', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '73 seconds', '63dcd6da-aca4-4ebe-9459-1404fd7ef9d4');

-- Q3 6:32 Entra al camp CIB David Martín (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 392000, 208000, 0, 'bdb9f9cc-67ee-407e-8a04-dc692e57964e', '7f34311a-4957-44ca-bf1e-c3c87e3369ee', timestamptz '2026-10-03 12:00:00+00' + interval '74 seconds');

-- Q3 6:32 Entra al camp CIB Joan Vidal (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 392000, 208000, 0, '7f34311a-4957-44ca-bf1e-c3c87e3369ee', '6fbb4c7f-36fd-4b2a-8954-97d7f194c02c', timestamptz '2026-10-03 12:00:00+00' + interval '75 seconds');

-- Q3 5:50 Personal hecha CIB David Martín (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 3, 350000, 250000, 0, 'personal', 'away', 'no_shot', 0, '13f82f54-5750-4228-971a-91ee72bf7732', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '76 seconds', 'bdb9f9cc-67ee-407e-8a04-dc692e57964e');

-- Q3 5:50 Entra al camp CIB Ander Otaola (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 350000, 250000, 0, '307ad59e-d102-4504-9314-0c4d5b233dd3', '63dcd6da-aca4-4ebe-9459-1404fd7ef9d4', timestamptz '2026-10-03 12:00:00+00' + interval '77 seconds');

-- Q3 5:09 Canasta de 2 puntos LES Victor Aliguer
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 309000, 291000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '78 seconds', 'e5964335-cbb5-4368-b96b-de3f27e0b297');

-- Q3 4:58 Entra al camp CIB Jan Vilanova (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 298000, 302000, 0, 'f3a7f33f-0f25-4977-bb40-57bd2ded0300', '33a33254-1c5f-4eea-9e35-264980f55b76', timestamptz '2026-10-03 12:00:00+00' + interval '79 seconds');

-- Q3 4:32 Personal hecha CIB Marçal Garcia (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 3, 272000, 328000, 0, 'personal', 'away', 'no_shot', 2, '945c93d8-f40d-4803-a6a5-40b6ba64ed16', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '80 seconds', '8d96cbad-3285-46c7-9c7b-100d31652005');

-- Q3 4:32 Entra al camp CIB Martín Ortas (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 272000, 328000, 0, 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0', '7f34311a-4957-44ca-bf1e-c3c87e3369ee', timestamptz '2026-10-03 12:00:00+00' + interval '81 seconds');

-- Q3 4:32 Canasta de 1 punto LES Ibai Fraile
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 272000, 328000, 1, true, '945c93d8-f40d-4803-a6a5-40b6ba64ed16', timestamptz '2026-10-03 12:00:00+00' + interval '82 seconds', '8810aef1-8f00-43aa-ba83-45c7ca651c7b');

-- Q3 4:32 Tiro libre fallado LES Ibai Fraile
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 272000, 328000, 0, false, '945c93d8-f40d-4803-a6a5-40b6ba64ed16', timestamptz '2026-10-03 12:00:00+00' + interval '83 seconds', '8810aef1-8f00-43aa-ba83-45c7ca651c7b');

-- Q3 4:04 Canasta de 2 puntos CIB Ander Otaola
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 244000, 356000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '84 seconds', '307ad59e-d102-4504-9314-0c4d5b233dd3');

-- Q3 3:44 Entra al camp LES Marc Verdiell (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 224000, 376000, 0, 'dafbc732-83a3-4572-8a9b-6919920978f2', 'e5964335-cbb5-4368-b96b-de3f27e0b297', timestamptz '2026-10-03 12:00:00+00' + interval '85 seconds');

-- Q3 3:44 Entra al camp LES Pere Moreno (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 224000, 376000, 0, '53dd0f6c-5587-499c-bbba-c134289c3b9b', '8810aef1-8f00-43aa-ba83-45c7ca651c7b', timestamptz '2026-10-03 12:00:00+00' + interval '86 seconds');

-- Q3 3:01 Personal hecha CIB Ander Otaola (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 3, 181000, 419000, 0, 'personal', 'away', 'no_shot', 2, '744dd8e1-f9b3-49b5-b0b9-8822744d5192', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '87 seconds', '307ad59e-d102-4504-9314-0c4d5b233dd3');

-- Q3 3:01 Tiro libre fallado LES Marc Verdiell
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 181000, 419000, 0, false, '744dd8e1-f9b3-49b5-b0b9-8822744d5192', timestamptz '2026-10-03 12:00:00+00' + interval '88 seconds', 'dafbc732-83a3-4572-8a9b-6919920978f2');

-- Q3 3:01 Tiro libre fallado LES Marc Verdiell
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 181000, 419000, 0, false, '744dd8e1-f9b3-49b5-b0b9-8822744d5192', timestamptz '2026-10-03 12:00:00+00' + interval '89 seconds', 'dafbc732-83a3-4572-8a9b-6919920978f2');

-- Q3 2:45 Personal hecha LES Marc Verdiell (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 3, 165000, 435000, 0, 'personal', 'home', 'no_shot', 2, '7d63704f-b665-4eab-a24c-440c4c77454c', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '90 seconds', 'dafbc732-83a3-4572-8a9b-6919920978f2');

-- Q3 2:45 Entra al camp LES Martí Izquierdo (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 165000, 435000, 0, '3beb7508-b322-480c-8313-a6eda611e3f2', '6e6f2ebe-eaf6-476f-9c9a-672840abec36', timestamptz '2026-10-03 12:00:00+00' + interval '91 seconds');

-- Q3 2:45 Tiro libre fallado CIB Marçal Garcia
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 165000, 435000, 0, false, '7d63704f-b665-4eab-a24c-440c4c77454c', timestamptz '2026-10-03 12:00:00+00' + interval '92 seconds', '8d96cbad-3285-46c7-9c7b-100d31652005');

-- Q3 2:45 Tiro libre fallado CIB Marçal Garcia
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 165000, 435000, 0, false, '7d63704f-b665-4eab-a24c-440c4c77454c', timestamptz '2026-10-03 12:00:00+00' + interval '93 seconds', '8d96cbad-3285-46c7-9c7b-100d31652005');

-- Q3 2:39 Canasta de 2 puntos CIB David Martín
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 159000, 441000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '94 seconds', 'bdb9f9cc-67ee-407e-8a04-dc692e57964e');

-- Q3 2:22 Entra al camp CIB Pol Torres Capellades (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 142000, 458000, 0, 'e6150adb-3505-4cf6-86ce-edb35cabd2bd', '8d96cbad-3285-46c7-9c7b-100d31652005', timestamptz '2026-10-03 12:00:00+00' + interval '95 seconds');

-- Q3 2:22 Entra al camp LES Ibai Fraile (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 142000, 458000, 0, '8810aef1-8f00-43aa-ba83-45c7ca651c7b', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', timestamptz '2026-10-03 12:00:00+00' + interval '96 seconds');

-- Q3 2:22 Personal hecha CIB David Martín (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 3, 142000, 458000, 0, 'personal', 'away', 'no_shot', 2, '3f141a45-967b-4425-83ec-c28f95233001', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '97 seconds', 'bdb9f9cc-67ee-407e-8a04-dc692e57964e');

-- Q3 2:22 Canasta de 1 punto LES Erick Dotta
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 142000, 458000, 1, true, '3f141a45-967b-4425-83ec-c28f95233001', timestamptz '2026-10-03 12:00:00+00' + interval '98 seconds', '81b4886d-2ad5-4790-aa66-9b85adf3813c');

-- Q3 2:22 Tiro libre fallado LES Erick Dotta
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 142000, 458000, 0, false, '3f141a45-967b-4425-83ec-c28f95233001', timestamptz '2026-10-03 12:00:00+00' + interval '99 seconds', '81b4886d-2ad5-4790-aa66-9b85adf3813c');

-- Q3 2:18 Canasta de 2 puntos LES Erick Dotta
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 138000, 462000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '100 seconds', '81b4886d-2ad5-4790-aa66-9b85adf3813c');

-- Q3 1:15 Canasta de 2 puntos CIB David Martín
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 75000, 525000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '101 seconds', 'bdb9f9cc-67ee-407e-8a04-dc692e57964e');

-- Q3 1:00 Personal hecha CIB Ander Otaola (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 3, 60000, 540000, 0, 'personal', 'away', 'no_shot', 2, '6af4c671-c318-4396-b237-6d2aa0af1eca', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '102 seconds', '307ad59e-d102-4504-9314-0c4d5b233dd3');

-- Q3 1:00 Entra al camp CIB Teo Liwei Tan (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 60000, 540000, 0, 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b', '307ad59e-d102-4504-9314-0c4d5b233dd3', timestamptz '2026-10-03 12:00:00+00' + interval '103 seconds');

-- Q3 1:00 Entra al camp CIB Rayan Benzaina (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 60000, 540000, 0, 'bc8cff16-4884-422c-ac81-baa4223dfeb6', 'bdb9f9cc-67ee-407e-8a04-dc692e57964e', timestamptz '2026-10-03 12:00:00+00' + interval '104 seconds');

-- Q3 1:00 Entra al camp LES Thomas Quintino (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 3, 60000, 540000, 0, '9db67521-4658-400d-80cd-7d0fb965ceac', '81b4886d-2ad5-4790-aa66-9b85adf3813c', timestamptz '2026-10-03 12:00:00+00' + interval '105 seconds');

-- Q3 1:00 Canasta de 1 punto LES Ibai Fraile
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 60000, 540000, 1, true, '6af4c671-c318-4396-b237-6d2aa0af1eca', timestamptz '2026-10-03 12:00:00+00' + interval '106 seconds', '8810aef1-8f00-43aa-ba83-45c7ca651c7b');

-- Q3 1:00 Tiro libre fallado LES Ibai Fraile
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 3, 60000, 540000, 0, false, '6af4c671-c318-4396-b237-6d2aa0af1eca', timestamptz '2026-10-03 12:00:00+00' + interval '107 seconds', '8810aef1-8f00-43aa-ba83-45c7ca651c7b');

-- Q3 0:26 Canasta de 2 puntos CIB Martín Ortas
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 26000, 574000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '108 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Q3 0:13 Canasta de 2 puntos CIB Martín Ortas
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 3, 13000, 587000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '109 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Cuarto 4. Primero el quinteto inicial, luego los eventos.
UPDATE games SET current_period = 4, clock_running = false, clock_remaining_ms = 600000 WHERE id = 'bd6f4442-4315-4a8c-b66f-22dd42af9d21';

INSERT INTO game_period_lineups (game_id, period_number, side, position_index, player_id, opponent_player_id) VALUES
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'home', 0, '53dd0f6c-5587-499c-bbba-c134289c3b9b', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'home', 1, 'dafbc732-83a3-4572-8a9b-6919920978f2', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'home', 2, '9db67521-4658-400d-80cd-7d0fb965ceac', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'home', 3, '3beb7508-b322-480c-8313-a6eda611e3f2', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'home', 4, '8810aef1-8f00-43aa-ba83-45c7ca651c7b', NULL),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'away', 0, NULL, 'e6150adb-3505-4cf6-86ce-edb35cabd2bd'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'away', 1, NULL, 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'away', 2, NULL, 'bc8cff16-4884-422c-ac81-baa4223dfeb6'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'away', 3, NULL, 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0'),
  ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 4, 'away', 4, NULL, 'f3a7f33f-0f25-4977-bb40-57bd2ded0300');

-- Q4 9:11 Canasta de 2 puntos CIB Pol Torres Capellades
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 551000, 49000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '110 seconds', 'e6150adb-3505-4cf6-86ce-edb35cabd2bd');

-- Q4 8:38 Personal hecha CIB Teo Liwei Tan (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 518000, 82000, 0, 'personal', 'away', 'no_shot', 2, '4174acae-2716-4a80-b905-7d16c717465e', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '111 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Q4 8:38 Entra al camp LES Flavio Loffredo (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 518000, 82000, 0, '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', '53dd0f6c-5587-499c-bbba-c134289c3b9b', timestamptz '2026-10-03 12:00:00+00' + interval '112 seconds');

-- Q4 8:38 Canasta de 1 punto LES Flavio Loffredo
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 518000, 82000, 1, true, '4174acae-2716-4a80-b905-7d16c717465e', timestamptz '2026-10-03 12:00:00+00' + interval '113 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Q4 8:38 Canasta de 1 punto LES Flavio Loffredo
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 518000, 82000, 1, true, '4174acae-2716-4a80-b905-7d16c717465e', timestamptz '2026-10-03 12:00:00+00' + interval '114 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Q4 8:37 Entra al camp LES Adrián Ibáñez (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 517000, 83000, 0, '6e6f2ebe-eaf6-476f-9c9a-672840abec36', 'dafbc732-83a3-4572-8a9b-6919920978f2', timestamptz '2026-10-03 12:00:00+00' + interval '115 seconds');

-- Q4 8:37 Entra al camp LES Victor Aliguer (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 517000, 83000, 0, 'e5964335-cbb5-4368-b96b-de3f27e0b297', '9db67521-4658-400d-80cd-7d0fb965ceac', timestamptz '2026-10-03 12:00:00+00' + interval '116 seconds');

-- Q4 8:37 Entra al camp LES Pere Moreno (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 517000, 83000, 0, '53dd0f6c-5587-499c-bbba-c134289c3b9b', '3beb7508-b322-480c-8313-a6eda611e3f2', timestamptz '2026-10-03 12:00:00+00' + interval '117 seconds');

-- Q4 8:00 Canasta de 2 puntos LES Victor Aliguer
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 480000, 120000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '118 seconds', 'e5964335-cbb5-4368-b96b-de3f27e0b297');

-- Q4 7:28 Canasta de 2 puntos LES Pere Moreno
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 448000, 152000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '119 seconds', '53dd0f6c-5587-499c-bbba-c134289c3b9b');

-- Q4 7:11 Canasta de 2 puntos CIB Pol Torres Capellades
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 431000, 169000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '120 seconds', 'e6150adb-3505-4cf6-86ce-edb35cabd2bd');

-- Q4 6:46 Personal hecha CIB Rayan Benzaina (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 406000, 194000, 0, 'personal', 'away', 'no_shot', 0, '49497544-d4bd-4586-b1d6-4ae4aec1e896', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '121 seconds', 'bc8cff16-4884-422c-ac81-baa4223dfeb6');

-- Q4 6:46 Entra al camp CIB Leonardo Dario (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 406000, 194000, 0, '33a33254-1c5f-4eea-9e35-264980f55b76', 'bc8cff16-4884-422c-ac81-baa4223dfeb6', timestamptz '2026-10-03 12:00:00+00' + interval '122 seconds');

-- Q4 6:46 Entra al camp CIB Robert Tormos (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 406000, 194000, 0, '63dcd6da-aca4-4ebe-9459-1404fd7ef9d4', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0', timestamptz '2026-10-03 12:00:00+00' + interval '123 seconds');

-- Q4 6:46 Entra al camp LES Marc Verdiell (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 406000, 194000, 0, 'dafbc732-83a3-4572-8a9b-6919920978f2', '8810aef1-8f00-43aa-ba83-45c7ca651c7b', timestamptz '2026-10-03 12:00:00+00' + interval '124 seconds');

-- Q4 6:38 Personal hecha CIB Teo Liwei Tan (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 398000, 202000, 0, 'personal', 'away', 'no_shot', 2, 'ed3ecab3-392c-4dac-b2aa-dee45ee9edb3', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '125 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Q4 6:38 Entra al camp CIB Ander Otaola (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 398000, 202000, 0, '307ad59e-d102-4504-9314-0c4d5b233dd3', 'f3a7f33f-0f25-4977-bb40-57bd2ded0300', timestamptz '2026-10-03 12:00:00+00' + interval '126 seconds');

-- Q4 6:38 Tiro libre fallado LES Victor Aliguer
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 398000, 202000, 0, false, 'ed3ecab3-392c-4dac-b2aa-dee45ee9edb3', timestamptz '2026-10-03 12:00:00+00' + interval '127 seconds', 'e5964335-cbb5-4368-b96b-de3f27e0b297');

-- Q4 6:38 Tiro libre fallado LES Victor Aliguer
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 398000, 202000, 0, false, 'ed3ecab3-392c-4dac-b2aa-dee45ee9edb3', timestamptz '2026-10-03 12:00:00+00' + interval '128 seconds', 'e5964335-cbb5-4368-b96b-de3f27e0b297');

-- Q4 6:24 Canasta de 2 puntos LES Pere Moreno
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 384000, 216000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '129 seconds', '53dd0f6c-5587-499c-bbba-c134289c3b9b');

-- Q4 5:38 Entra al camp CIB Martín Ortas (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 338000, 262000, 0, 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0', 'e6150adb-3505-4cf6-86ce-edb35cabd2bd', timestamptz '2026-10-03 12:00:00+00' + interval '130 seconds');

-- Q4 5:34 Personal hecha LES Flavio Loffredo (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 334000, 266000, 0, 'personal', 'home', 'no_shot', 0, 'a7b5a3c6-17d1-47bd-a7e4-16c5febad7e4', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '131 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Q4 5:20 Personal hecha LES Adrián Ibáñez (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 320000, 280000, 0, 'personal', 'home', 'no_shot', 2, '2726a07a-901a-4d3b-8e8d-1250305a70a0', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '132 seconds', '6e6f2ebe-eaf6-476f-9c9a-672840abec36');

-- Q4 5:20 Entra al camp LES Ibai Fraile (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 320000, 280000, 0, '8810aef1-8f00-43aa-ba83-45c7ca651c7b', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', timestamptz '2026-10-03 12:00:00+00' + interval '133 seconds');

-- Q4 5:20 Tiro libre fallado CIB Martín Ortas
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 320000, 280000, 0, false, '2726a07a-901a-4d3b-8e8d-1250305a70a0', timestamptz '2026-10-03 12:00:00+00' + interval '134 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Q4 5:20 Tiro libre fallado CIB Martín Ortas
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 320000, 280000, 0, false, '2726a07a-901a-4d3b-8e8d-1250305a70a0', timestamptz '2026-10-03 12:00:00+00' + interval '135 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Q4 4:51 Canasta de 2 puntos LES Victor Aliguer
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 291000, 309000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '136 seconds', 'e5964335-cbb5-4368-b96b-de3f27e0b297');

-- Q4 4:35 Personal hecha CIB Martín Ortas (0 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 275000, 325000, 0, 'personal', 'away', 'no_shot', 0, '0e9d4f5c-83f8-4454-80d3-712ae102faa9', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '137 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Q4 4:13 Canasta de 2 puntos LES Pere Moreno
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 253000, 347000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '138 seconds', '53dd0f6c-5587-499c-bbba-c134289c3b9b');

-- Q4 3:23 Canasta de 2 puntos CIB Robert Tormos
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 203000, 397000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '139 seconds', '63dcd6da-aca4-4ebe-9459-1404fd7ef9d4');

-- Q4 3:15 Personal hecha CIB Ander Otaola (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 195000, 405000, 0, 'personal', 'away', 'no_shot', 2, 'b6a0b803-03d1-4db7-ba00-026bf2bc3016', 'home', timestamptz '2026-10-03 12:00:00+00' + interval '140 seconds', '307ad59e-d102-4504-9314-0c4d5b233dd3');

-- Q4 3:15 Entra al camp CIB Marçal Garcia (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 195000, 405000, 0, '8d96cbad-3285-46c7-9c7b-100d31652005', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b', timestamptz '2026-10-03 12:00:00+00' + interval '141 seconds');

-- Q4 3:15 Canasta de 1 punto LES Victor Aliguer
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 195000, 405000, 1, true, 'b6a0b803-03d1-4db7-ba00-026bf2bc3016', timestamptz '2026-10-03 12:00:00+00' + interval '142 seconds', 'e5964335-cbb5-4368-b96b-de3f27e0b297');

-- Q4 3:15 Canasta de 1 punto LES Victor Aliguer
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 195000, 405000, 1, true, 'b6a0b803-03d1-4db7-ba00-026bf2bc3016', timestamptz '2026-10-03 12:00:00+00' + interval '143 seconds', 'e5964335-cbb5-4368-b96b-de3f27e0b297');

-- Q4 3:04 Personal hecha LES Ibai Fraile (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 184000, 416000, 0, 'personal', 'home', 'no_shot', 2, 'f11be2fa-85c0-46e3-8cef-644e641c63fd', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '144 seconds', '8810aef1-8f00-43aa-ba83-45c7ca651c7b');

-- Q4 3:04 Tiro libre fallado CIB Martín Ortas
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 184000, 416000, 0, false, 'f11be2fa-85c0-46e3-8cef-644e641c63fd', timestamptz '2026-10-03 12:00:00+00' + interval '145 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Q4 3:04 Tiro libre fallado CIB Martín Ortas
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 184000, 416000, 0, false, 'f11be2fa-85c0-46e3-8cef-644e641c63fd', timestamptz '2026-10-03 12:00:00+00' + interval '146 seconds', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0');

-- Q4 2:51 Entra al camp CIB Pol Torres Capellades (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 171000, 429000, 0, 'e6150adb-3505-4cf6-86ce-edb35cabd2bd', '307ad59e-d102-4504-9314-0c4d5b233dd3', timestamptz '2026-10-03 12:00:00+00' + interval '147 seconds');

-- Q4 2:51 Entra al camp LES Flavio Loffredo (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 171000, 429000, 0, '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', '6e6f2ebe-eaf6-476f-9c9a-672840abec36', timestamptz '2026-10-03 12:00:00+00' + interval '148 seconds');

-- Q4 2:51 Entra al camp LES Erick Dotta (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 171000, 429000, 0, '81b4886d-2ad5-4790-aa66-9b85adf3813c', 'dafbc732-83a3-4572-8a9b-6919920978f2', timestamptz '2026-10-03 12:00:00+00' + interval '149 seconds');

-- Q4 1:50 Canasta de 2 puntos CIB Robert Tormos
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 110000, 490000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '150 seconds', '63dcd6da-aca4-4ebe-9459-1404fd7ef9d4');

-- Q4 1:40 Tiempo muerto LES * NO APLICA *
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, timeout_side, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'timeout', 4, 100000, 500000, 0, 'home', timestamptz '2026-10-03 12:00:00+00' + interval '151 seconds');

-- Q4 1:34 Canasta de 2 puntos CIB Marçal Garcia
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'shot', 4, 94000, 506000, 2, true, timestamptz '2026-10-03 12:00:00+00' + interval '152 seconds', '8d96cbad-3285-46c7-9c7b-100d31652005');

-- Q4 0:54 Personal hecha LES Victor Aliguer (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 54000, 546000, 0, 'personal', 'home', 'no_shot', 2, '56941bbb-847a-4d0d-a6a1-90ed967189ec', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '153 seconds', 'e5964335-cbb5-4368-b96b-de3f27e0b297');

-- Q4 0:54 Tiro libre fallado CIB Pol Torres Capellades
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 54000, 546000, 0, false, '56941bbb-847a-4d0d-a6a1-90ed967189ec', timestamptz '2026-10-03 12:00:00+00' + interval '154 seconds', 'e6150adb-3505-4cf6-86ce-edb35cabd2bd');

-- Q4 0:54 Canasta de 1 punto CIB Pol Torres Capellades
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 54000, 546000, 1, true, '56941bbb-847a-4d0d-a6a1-90ed967189ec', timestamptz '2026-10-03 12:00:00+00' + interval '155 seconds', 'e6150adb-3505-4cf6-86ce-edb35cabd2bd');

-- Q4 0:54 Entra al camp CIB Teo Liwei Tan (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 54000, 546000, 0, 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b', 'e6150adb-3505-4cf6-86ce-edb35cabd2bd', timestamptz '2026-10-03 12:00:00+00' + interval '156 seconds');

-- Q4 0:26 Personal hecha LES Flavio Loffredo (2 tiros libres)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, foul_type, foul_side, foul_context, free_throws_awarded, play_group_id, possession_before, created_at, player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'foul', 4, 26000, 574000, 0, 'personal', 'home', 'no_shot', 2, '171bc9d3-e863-4744-8916-6da3081a1a4b', 'away', timestamptz '2026-10-03 12:00:00+00' + interval '157 seconds', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557');

-- Q4 0:26 Entra al camp CIB Joan Vidal (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, opponent_player_id, opponent_player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 26000, 574000, 0, '7f34311a-4957-44ca-bf1e-c3c87e3369ee', 'b55e3805-7aec-4c3d-8c6d-f297a5a721d0', timestamptz '2026-10-03 12:00:00+00' + interval '158 seconds');

-- Q4 0:26 Entra al camp LES Max Namuth (sale el emparejado)
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, player_id, player_out_id, created_at) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'substitution', 4, 26000, 574000, 0, '6cb09a89-e482-4b72-a6a4-44bfccfe5007', '0bca2abf-d4fe-4736-b3e4-71c8e19e8557', timestamptz '2026-10-03 12:00:00+00' + interval '159 seconds');

-- Q4 0:26 Tiro libre fallado CIB Teo Liwei Tan
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 26000, 574000, 0, false, '171bc9d3-e863-4744-8916-6da3081a1a4b', timestamptz '2026-10-03 12:00:00+00' + interval '160 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Q4 0:26 Tiro libre fallado CIB Teo Liwei Tan
INSERT INTO game_events (game_id, event_type, period_number, clock_remaining_ms, elapsed_ms, points, made, play_group_id, created_at, opponent_player_id) VALUES ('bd6f4442-4315-4a8c-b66f-22dd42af9d21', 'free_throw', 4, 26000, 574000, 0, false, '171bc9d3-e863-4744-8916-6da3081a1a4b', timestamptz '2026-10-03 12:00:00+00' + interval '161 seconds', 'fddf3b19-e7e2-4a75-a27c-76255a6d2a0b');

-- Marcador final de la hoja: Lestonnac 31, Ciutat Vella 43. Reloj parado en el último apunte.
UPDATE games
SET team_score = 31,
    opponent_score = 43,
    current_period = 4,
    clock_remaining_ms = 26000,
    clock_running = false,
    opening_tip_winner = 'home',
    possession = 'home'
WHERE id = 'bd6f4442-4315-4a8c-b66f-22dd42af9d21';

SELECT event_type, count(*) AS n
FROM game_events
WHERE game_id = 'bd6f4442-4315-4a8c-b66f-22dd42af9d21'
GROUP BY event_type
ORDER BY event_type;

COMMIT;
