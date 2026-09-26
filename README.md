# BasquetStat

A comprehensive basketball statistics management application built for tracking team performance, player stats, and live game capture with role-based access control.

## ⚠️ SECURITY NOTICE

**NEVER commit real credentials to git.** All secrets must be stored in `.env.local` (which is gitignored). The `.env.example` file contains only empty placeholders. If real credentials were ever committed to this repository:

1. Rotate all affected keys immediately in your Supabase dashboard
2. Generate new API keys and service role keys
3. Never put real values in `.env.example` or commit `.env.local` files

Always use `.env.local` for local development and secure environment variables on deployment platforms (Vercel, etc.).

## Product Overview

BasquetStat is designed for basketball teams following FIBA rules (4 quarters × 10 minutes). The system supports:

- **Own team management**: Complete player roster, stats, and game tracking
- **Opponent tracking**: Simple name + score entry (typed by scorers)
- **Live game capture**: Dual-operator system with Slot A and Slot B roles
- **Multi-language support**: English, Spanish (Castellano), and Catalan
- **Role-based access**: Five distinct user roles with appropriate permissions

### Data Hierarchy

```
Season → Team → Players → Games
                        ↓
                    Game Events (shots, rebounds, fouls, etc.)
                        ↓
                    Player Statistics
```

### Live Capture Model (Phase 2 - IMPLEMENTED ✅)

During live games, two Team Managers work simultaneously via Supabase Realtime:

- **Slot A Operator**: Game clock control (play/pause, ±adjust), shots with half-court coordinates (1/2/3 pts), fouls, substitutions (auto-tracking stints), opponent score entry
- **Slot B Operator**: Rebounds (overlay after miss), assists (prompt after make), steals, turnovers

**Key Features:**
- **Real-time sync**: Both operators see updates instantly via Supabase Realtime
- **Role swapping**: Admins can swap A↔B assignments mid-game
- **Shot tracking**: Tap half-court to record location; coordinates normalized 0-1, zones 1-4 (paint, right arc, left arc, 3pt)
- **Auto-prompts**: Slot B gets rebound overlay after misses, assist prompt after makes
- **Possession**: Auto-switches; manually correctable
- **Undo**: Last event with cross-user warning
- **Connection indicator**: Shows active users and slot assignments

**Routes:**
- `/team-manager/games/[id]` - Assign slots A/B, swap roles, start/resume game
- `/team-manager/games/[id]/capture` - Live capture interface (renders A or B based on assignment)

## User Roles

### Admin
- **Access**: Full system control
- **Capabilities**: Create users, seasons, teams, players, games, and manage all data
- **Use case**: Oscar (system owner)

### Team Manager
- **Access**: Live game capture (Slot A or B) and team/player viewing
- **Capabilities**: Record game events in real-time, view all players and team data
- **Use case**: Assistant coaches who score games

### Coach
- **Access**: Read-only for entire team
- **Capabilities**: View all players, statistics, and game results
- **Use case**: Head coach reviewing team performance

### Parent
- **Access**: Read-only for linked child(ren) only
- **Capabilities**: View their child's statistics and game participation
- **Use case**: Parents tracking their child's development
- **Security**: RLS policies prevent viewing other players' data

### Player
- **Access**: Read-only for own statistics only
- **Capabilities**: View personal stats, games played, and performance metrics
- **Use case**: Players checking their own progress
- **Security**: RLS policies prevent viewing other players' data

## Internationalization (i18n)

All user-facing strings use translation keys starting with `trke_`:

- Example: `trke_login_title`, `trke_dashboard_players`, `trke_game_status_live`
- Supported locales: `en` (English), `es` (Español), `ca` (Català)
- Language preference stored in user profile
- Translation management available in Admin dashboard at `/admin/translations`

**Developer Note**: Every new UI string MUST follow the `trke_*` naming convention and be added to the `translations` table for all three locales.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password)
- **Real-time** (future): Supabase Realtime for live game capture

## Database Schema

### Core Tables

- `profiles`: User accounts with role and language preference
- `seasons`: Basketball seasons (start/end dates, active status)
- `teams`: Teams linked to seasons
- `players`: Player roster with jersey numbers, positions, and optional user links
- `parent_player_links`: Parent-child relationships for access control
- `games`: Game records with opponent, venue, date, status, **official flag** (true=competition, false=friendly), and **Slot A/B user assignments**
- `game_periods`: Quarter and overtime tracking
- `stints`: Player minutes tracking (in/out timestamps tied to game clock)
- `game_events`: All game actions (shots, fouls, rebounds, assists, steals, turnovers) with:
  - Period number
  - Clock remaining (ms)
  - Elapsed time (ms)
  - Shot coordinates (x, y) and zone (1-4) for heatmaps
  - Offensive/defensive possession flag
- `translations`: i18n string storage (key, locale, value)

### Row Level Security (RLS)

All tables have RLS enabled with policies enforcing:

- Admins can access everything
- Team Managers can manage games and events
- Coaches can view all team data (read-only)
- Parents can only view their linked children's data
- Players can only view their own data

## Environment Variables

Create a `.env.local` file (or configure in your deployment platform):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Note**: If you don't have Supabase keys yet, the migrations and seed scripts will guide you to set up a local or cloud Supabase project.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works) or local Supabase setup

### Installation

1. Clone the repository:
```bash
git clone https://github.com/omoreno222/basquet_stat.git
cd basquet_stat
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

4. Apply database migrations:

**Option A: Using Supabase CLI (recommended)**
```bash
# Install Supabase CLI: https://supabase.com/docs/guides/cli
supabase link --project-ref your-project-ref
supabase db push
```

**Option B: Manual SQL execution**
```bash
# Run migrations in order:
# 001_initial_schema.sql
# 002_fix_profiles_rls.sql
# 003_live_game_clock.sql
# 004_games_official.sql (NEW: adds official/friendly game distinction)
```

**⚠️ IMPORTANT**: If you have an existing database, make sure to run migration `004_games_official.sql` to add the `official` column to the games table.

5. Seed the database:
```bash
npm run db:seed
```

This creates:
- 5 demo users (one for each role)
- 1 active season (2024-2025)
- 1 team (Junior Warriors)
- 5 players with jersey numbers
- 1 parent-player link
- 2 scheduled games (1 official, 1 friendly) with Slot A assigned
- Translation strings in EN, ES, and CA (including new admin CRUD UI strings)

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts

After seeding, log in with these accounts:

| Role          | Email                    | Password     |
|---------------|--------------------------|--------------|
| Admin         | oscar@basquet.local      | basquet2024  |
| Team Manager  | manager@basquet.local    | basquet2024  |
| Coach         | coach@basquet.local      | basquet2024  |
| Parent        | parent@basquet.local     | basquet2024  |
| Player        | player@basquet.local     | basquet2024  |

## Application Routes

- `/login` - Authentication page (supports .local domains)
- `/` - Redirects to role-specific home
- `/admin` - Admin dashboard (seasons, teams, players, users, games, translations)
- `/admin/seasons` - **Season CRUD** (create, edit, delete, set active)
- `/admin/teams` - **Team CRUD** (create, edit, delete with season linking)
- `/admin/players` - **Player CRUD** (create, edit, delete with team linking)
- `/admin/users` - **User CRUD** (create via server action, edit role, link parent→player)
- `/admin/games` - **Game CRUD** (create, edit, delete with official/friendly flag)
- `/admin/translations` - **i18n management** (list, edit translation values)
- `/team-manager` - Game list with Slot A/B status
- `/team-manager/games/[id]` - **Game detail: assign/swap slots, start/resume**
- `/team-manager/games/[id]/capture` - **Live capture interface (Slot A or B)**
- `/coach` - Team roster and statistics (read-only)
- `/parent` - Linked children's statistics (read-only, RLS enforced)
- `/player` - Personal statistics (read-only, RLS enforced)

## Security Features

- **Authentication**: Supabase Auth with email/password
- **Session Management**: HTTP-only cookies via middleware
- **Role-Based Access Control**: Middleware enforces route access by role
- **Row Level Security**: Database-level policies prevent unauthorized data access
- **Parent Privacy**: RLS ensures parents only see their linked children
- **Player Privacy**: RLS ensures players only see their own data

## Deployment

### Vercel + Supabase (Recommended)

1. **Supabase Setup**:
   - Create a project at [supabase.com](https://supabase.com)
   - Run migrations using Supabase CLI or SQL Editor
   - Note your project URL and keys

2. **Vercel Deployment**:
   - Push code to GitHub
   - Import project in [vercel.com](https://vercel.com)
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - Deploy

3. **Seed Production Data**:
   ```bash
   # Run locally with production env vars, or create a seed API route
   npm run db:seed
   ```

### Other Platforms

The app works on any platform supporting Next.js:
- AWS Amplify
- Netlify
- Railway
- DigitalOcean App Platform

Just ensure environment variables are configured.

## Development Roadmap

### ✅ Phase 1: Foundation (COMPLETE)

- [x] Database schema with migrations
- [x] User authentication and role management
- [x] Admin CRUD interfaces
- [x] Role-based routing and RLS
- [x] i18n foundation with trke_ convention
- [x] Game model with Slot A/B assignments
- [x] Seed data for all roles

### 🚧 Phase 2: Live Capture UI (Next)

- [ ] Real-time game clock with start/pause
- [ ] Slot A interface: Shots (1/2/3 pts), fouls, subs, opponent score
- [ ] Slot B interface: Rebounds, assists, turnovers, steals
- [ ] Half-court shot zone selector (4 zones)
- [ ] Possession tracking (offense/defense with corrections)
- [ ] Supabase Realtime sync for dual operators
- [ ] Stint auto-tracking from substitutions

### 📊 Phase 3: Analytics (Future)

- [ ] Player stat calculations (PPG, RPG, APG, FG%, etc.)
- [ ] Shot heatmaps by zone
- [ ] Team and player dashboards with charts
- [ ] Game summaries and box scores
- [ ] Season-wide statistics and trends

### 🎯 Phase 4: Advanced Features (Future)

- [ ] Overtime support
- [ ] PDF/CSV export of stats and box scores
- [ ] Mobile-responsive live capture
- [ ] Play-by-play timeline
- [ ] Advanced filters and search

## Code Conventions

- **TypeScript**: Strict mode enabled, full type coverage
- **Comments**: English only in code; UI text via `trke_*` translations
- **File Structure**: Next.js App Router conventions
- **Database**: All keys use `trke_` prefix for translation strings
- **Styling**: Tailwind utility classes, no custom CSS modules

## Testing Notes

After setup, verify:

1. **Install + migrate + seed boots**: `npm install && npm run db:seed && npm run dev`
2. **Five roles land on distinct homes**: Log in as each demo account and confirm correct route
3. **Admin can create season/team/player/user**: Test CRUD operations in admin dashboard
4. **Parent cannot open another child's page**: RLS should block unauthorized player detail access
5. **Game model has A/B slots**: Inspect `games` table for `slot_a_user_id` and `slot_b_user_id`
6. **Translations with trke_ work**: Check `/admin/translations` and verify login page uses translation keys

## Contributing

This is a private project for Oscar's basketball team. Contributions are by invitation only.

## License

Proprietary - All rights reserved

## Support

For issues or questions, contact: oscar@basquet.local

---

**Built with ❤️ for Junior Warriors Basketball**
