const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('Starting seed...');

  try {
    // Create users with Supabase Auth
    const users = [];
    const userConfigs = [
      { email: 'oscar@basquet.local', password: 'basquet2024', role: 'admin', full_name: 'Oscar Admin' },
      { email: 'manager@basquet.local', password: 'basquet2024', role: 'team_manager', full_name: 'Team Manager' },
      { email: 'coach@basquet.local', password: 'basquet2024', role: 'coach', full_name: 'Head Coach' },
      { email: 'parent@basquet.local', password: 'basquet2024', role: 'parent', full_name: 'Parent User' },
      { email: 'player@basquet.local', password: 'basquet2024', role: 'player', full_name: 'Player User' },
    ];

    console.log('Creating users...');
    for (const config of userConfigs) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true,
      });

      if (authError && !authError.message.includes('already registered')) {
        console.error(`Error creating user ${config.email}:`, authError);
        continue;
      }

      if (authData.user) {
        users.push({ ...config, id: authData.user.id });
        
        // Insert or update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: config.email,
            full_name: config.full_name,
            role: config.role,
            language: 'en',
          });

        if (profileError) {
          console.error(`Error creating profile for ${config.email}:`, profileError);
        } else {
          console.log(`✓ Created user: ${config.email} (${config.role})`);
        }
      }
    }

    // Create a season
    console.log('Creating season...');
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .insert({
        name: '2024-2025 Season',
        start_date: '2024-09-01',
        end_date: '2025-06-30',
        is_active: true,
      })
      .select()
      .single();

    if (seasonError) {
      console.error('Error creating season:', seasonError);
      return;
    }
    console.log('✓ Created season:', season.name);

    // Create a team
    console.log('Creating team...');
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        season_id: season.id,
        name: 'Junior Warriors',
      })
      .select()
      .single();

    if (teamError) {
      console.error('Error creating team:', teamError);
      return;
    }
    console.log('✓ Created team:', team.name);

    // Create players
    console.log('Creating players...');
    const playerUser = users.find(u => u.role === 'player');
    const playersData = [
      { full_name: 'Marc Garcia', jersey_number: 7, position: 'Guard', user_id: playerUser?.id },
      { full_name: 'Anna Lopez', jersey_number: 12, position: 'Forward' },
      { full_name: 'Joan Martinez', jersey_number: 23, position: 'Center' },
      { full_name: 'Laura Sanchez', jersey_number: 15, position: 'Guard' },
      { full_name: 'David Rodriguez', jersey_number: 32, position: 'Forward' },
    ];

    const players = [];
    for (const playerData of playersData) {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          team_id: team.id,
          ...playerData,
        })
        .select()
        .single();

      if (playerError) {
        console.error(`Error creating player ${playerData.full_name}:`, playerError);
      } else {
        players.push(player);
        console.log(`✓ Created player: #${player.jersey_number} ${player.full_name}`);
      }
    }

    // Link parent to player
    if (players.length > 0) {
      const parentUser = users.find(u => u.role === 'parent');
      if (parentUser) {
        const { error: linkError } = await supabase
          .from('parent_player_links')
          .insert({
            parent_id: parentUser.id,
            player_id: players[0].id,
          });

        if (linkError) {
          console.error('Error creating parent-player link:', linkError);
        } else {
          console.log(`✓ Linked parent to player: ${players[0].full_name}`);
        }
      }
    }

    // Create a game
    console.log('Creating game...');
    const managerUser = users.find(u => u.role === 'team_manager');
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        team_id: team.id,
        opponent_name: 'Lions Basketball',
        is_home: true,
        venue: 'Main Sports Center',
        game_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'scheduled',
        slot_a_user_id: managerUser?.id,
        slot_b_user_id: null,
      })
      .select()
      .single();

    if (gameError) {
      console.error('Error creating game:', gameError);
    } else {
      console.log('✓ Created game:', `${team.name} vs ${game.opponent_name}`);
    }

    // Create translations
    console.log('Creating translations...');
    const translations = [
      // Login page
      { key: 'trke_login_title', locale: 'en', value: 'Sign In' },
      { key: 'trke_login_title', locale: 'es', value: 'Iniciar Sesión' },
      { key: 'trke_login_title', locale: 'ca', value: 'Iniciar Sessió' },
      
      { key: 'trke_login_email', locale: 'en', value: 'Email' },
      { key: 'trke_login_email', locale: 'es', value: 'Correo Electrónico' },
      { key: 'trke_login_email', locale: 'ca', value: 'Correu Electrònic' },
      
      { key: 'trke_login_password', locale: 'en', value: 'Password' },
      { key: 'trke_login_password', locale: 'es', value: 'Contraseña' },
      { key: 'trke_login_password', locale: 'ca', value: 'Contrasenya' },
      
      { key: 'trke_login_button', locale: 'en', value: 'Sign In' },
      { key: 'trke_login_button', locale: 'es', value: 'Entrar' },
      { key: 'trke_login_button', locale: 'ca', value: 'Entrar' },
      
      // Common
      { key: 'trke_logout', locale: 'en', value: 'Logout' },
      { key: 'trke_logout', locale: 'es', value: 'Cerrar Sesión' },
      { key: 'trke_logout', locale: 'ca', value: 'Tancar Sessió' },
      
      { key: 'trke_welcome', locale: 'en', value: 'Welcome' },
      { key: 'trke_welcome', locale: 'es', value: 'Bienvenido' },
      { key: 'trke_welcome', locale: 'ca', value: 'Benvingut' },
      
      // Dashboard
      { key: 'trke_dashboard_seasons', locale: 'en', value: 'Seasons' },
      { key: 'trke_dashboard_seasons', locale: 'es', value: 'Temporadas' },
      { key: 'trke_dashboard_seasons', locale: 'ca', value: 'Temporades' },
      
      { key: 'trke_dashboard_teams', locale: 'en', value: 'Teams' },
      { key: 'trke_dashboard_teams', locale: 'es', value: 'Equipos' },
      { key: 'trke_dashboard_teams', locale: 'ca', value: 'Equips' },
      
      { key: 'trke_dashboard_players', locale: 'en', value: 'Players' },
      { key: 'trke_dashboard_players', locale: 'es', value: 'Jugadores' },
      { key: 'trke_dashboard_players', locale: 'ca', value: 'Jugadors' },
      
      { key: 'trke_dashboard_games', locale: 'en', value: 'Games' },
      { key: 'trke_dashboard_games', locale: 'es', value: 'Partidos' },
      { key: 'trke_dashboard_games', locale: 'ca', value: 'Partits' },
      
      // Game status
      { key: 'trke_game_status_scheduled', locale: 'en', value: 'Scheduled' },
      { key: 'trke_game_status_scheduled', locale: 'es', value: 'Programado' },
      { key: 'trke_game_status_scheduled', locale: 'ca', value: 'Programat' },
      
      { key: 'trke_game_status_live', locale: 'en', value: 'Live' },
      { key: 'trke_game_status_live', locale: 'es', value: 'En Vivo' },
      { key: 'trke_game_status_live', locale: 'ca', value: 'En Directe' },
      
      { key: 'trke_game_status_final', locale: 'en', value: 'Final' },
      { key: 'trke_game_status_final', locale: 'es', value: 'Finalizado' },
      { key: 'trke_game_status_final', locale: 'ca', value: 'Finalitzat' },
      
      // Live capture
      { key: 'trke_capture_slot_a', locale: 'en', value: 'Slot A' },
      { key: 'trke_capture_slot_a', locale: 'es', value: 'Puesto A' },
      { key: 'trke_capture_slot_a', locale: 'ca', value: 'Posició A' },
      
      { key: 'trke_capture_slot_b', locale: 'en', value: 'Slot B' },
      { key: 'trke_capture_slot_b', locale: 'es', value: 'Puesto B' },
      { key: 'trke_capture_slot_b', locale: 'ca', value: 'Posició B' },
      
      { key: 'trke_capture_period', locale: 'en', value: 'Period' },
      { key: 'trke_capture_period', locale: 'es', value: 'Período' },
      { key: 'trke_capture_period', locale: 'ca', value: 'Període' },
      
      { key: 'trke_capture_start', locale: 'en', value: 'START' },
      { key: 'trke_capture_start', locale: 'es', value: 'INICIAR' },
      { key: 'trke_capture_start', locale: 'ca', value: 'INICIAR' },
      
      { key: 'trke_capture_pause', locale: 'en', value: 'PAUSE' },
      { key: 'trke_capture_pause', locale: 'es', value: 'PAUSAR' },
      { key: 'trke_capture_pause', locale: 'ca', value: 'PAUSAR' },
      
      { key: 'trke_capture_possession', locale: 'en', value: 'Possession' },
      { key: 'trke_capture_possession', locale: 'es', value: 'Posesión' },
      { key: 'trke_capture_possession', locale: 'ca', value: 'Possessió' },
      
      { key: 'trke_capture_select_player', locale: 'en', value: 'Select Player' },
      { key: 'trke_capture_select_player', locale: 'es', value: 'Seleccionar Jugador' },
      { key: 'trke_capture_select_player', locale: 'ca', value: 'Seleccionar Jugador' },
      
      { key: 'trke_capture_shot_2pt', locale: 'en', value: '2-Point Shot' },
      { key: 'trke_capture_shot_2pt', locale: 'es', value: 'Tiro de 2 Puntos' },
      { key: 'trke_capture_shot_2pt', locale: 'ca', value: 'Tir de 2 Punts' },
      
      { key: 'trke_capture_shot_3pt', locale: 'en', value: '3-Point Shot' },
      { key: 'trke_capture_shot_3pt', locale: 'es', value: 'Tiro de 3 Puntos' },
      { key: 'trke_capture_shot_3pt', locale: 'ca', value: 'Tir de 3 Punts' },
      
      { key: 'trke_capture_free_throw', locale: 'en', value: 'Free Throw' },
      { key: 'trke_capture_free_throw', locale: 'es', value: 'Tiro Libre' },
      { key: 'trke_capture_free_throw', locale: 'ca', value: 'Tir Lliure' },
      
      { key: 'trke_capture_foul', locale: 'en', value: 'Foul' },
      { key: 'trke_capture_foul', locale: 'es', value: 'Falta' },
      { key: 'trke_capture_foul', locale: 'ca', value: 'Falta' },
      
      { key: 'trke_capture_rebound', locale: 'en', value: 'Rebound' },
      { key: 'trke_capture_rebound', locale: 'es', value: 'Rebote' },
      { key: 'trke_capture_rebound', locale: 'ca', value: 'Rebot' },
      
      { key: 'trke_capture_assist', locale: 'en', value: 'Assist' },
      { key: 'trke_capture_assist', locale: 'es', value: 'Asistencia' },
      { key: 'trke_capture_assist', locale: 'ca', value: 'Assistència' },
      
      { key: 'trke_capture_steal', locale: 'en', value: 'Steal' },
      { key: 'trke_capture_steal', locale: 'es', value: 'Robo' },
      { key: 'trke_capture_steal', locale: 'ca', value: 'Robatori' },
      
      { key: 'trke_capture_turnover', locale: 'en', value: 'Turnover' },
      { key: 'trke_capture_turnover', locale: 'es', value: 'Pérdida' },
      { key: 'trke_capture_turnover', locale: 'ca', value: 'Pèrdua' },
      
      { key: 'trke_capture_undo', locale: 'en', value: 'Undo Last' },
      { key: 'trke_capture_undo', locale: 'es', value: 'Deshacer Último' },
      { key: 'trke_capture_undo', locale: 'ca', value: 'Desfer Últim' },
      
      { key: 'trke_capture_opponent_score', locale: 'en', value: 'Opponent Score' },
      { key: 'trke_capture_opponent_score', locale: 'es', value: 'Puntuación Rival' },
      { key: 'trke_capture_opponent_score', locale: 'ca', value: 'Puntuació Rival' },
      
      { key: 'trke_capture_event_feed', locale: 'en', value: 'Event Feed' },
      { key: 'trke_capture_event_feed', locale: 'es', value: 'Registro de Eventos' },
      { key: 'trke_capture_event_feed', locale: 'ca', value: 'Registre d\'Esdeveniments' },
      
      { key: 'trke_capture_assign_slots', locale: 'en', value: 'Assign Slots' },
      { key: 'trke_capture_assign_slots', locale: 'es', value: 'Asignar Puestos' },
      { key: 'trke_capture_assign_slots', locale: 'ca', value: 'Assignar Posicions' },
      
      { key: 'trke_capture_swap_slots', locale: 'en', value: 'Swap A ↔ B' },
      { key: 'trke_capture_swap_slots', locale: 'es', value: 'Intercambiar A ↔ B' },
      { key: 'trke_capture_swap_slots', locale: 'ca', value: 'Intercanviar A ↔ B' },
      
      { key: 'trke_capture_start_game', locale: 'en', value: 'Start Game' },
      { key: 'trke_capture_start_game', locale: 'es', value: 'Iniciar Partido' },
      { key: 'trke_capture_start_game', locale: 'ca', value: 'Iniciar Partit' },
      
      { key: 'trke_capture_resume', locale: 'en', value: 'Resume Live Capture' },
      { key: 'trke_capture_resume', locale: 'es', value: 'Reanudar Captura en Vivo' },
      { key: 'trke_capture_resume', locale: 'ca', value: 'Reprendre Captura en Directe' },
    ];

    const { error: translationError } = await supabase
      .from('translations')
      .upsert(translations, { onConflict: 'key,locale' });

    if (translationError) {
      console.error('Error creating translations:', translationError);
    } else {
      console.log(`✓ Created ${translations.length} translations`);
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\nDemo accounts:');
    userConfigs.forEach(user => {
      console.log(`  ${user.role.padEnd(15)} ${user.email.padEnd(30)} ${user.password}`);
    });

  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
