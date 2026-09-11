# BasquetStat Foundation - Quick Reference

## 📂 Project Structure

```
basquet_stat/
├── app/                          # Next.js App Router pages
│   ├── admin/                    # Admin role pages
│   │   ├── games/page.tsx       # View all games
│   │   ├── players/page.tsx     # Manage players
│   │   ├── seasons/page.tsx     # Manage seasons
│   │   ├── teams/page.tsx       # Manage teams
│   │   ├── translations/page.tsx # i18n management
│   │   ├── users/page.tsx       # User management
│   │   └── page.tsx             # Admin dashboard
│   ├── coach/page.tsx           # Coach dashboard (read-only)
│   ├── login/page.tsx           # Login page
│   ├── parent/page.tsx          # Parent dashboard (RLS enforced)
│   ├── player/page.tsx          # Player dashboard (RLS enforced)
│   ├── team-manager/page.tsx   # Team Manager dashboard
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Root redirect
├── lib/
│   ├── i18n.ts                  # Translation utilities
│   └── supabase.ts              # Supabase client setup
├── scripts/
│   ├── migrate.js               # Migration runner
│   └── seed.js                  # Database seeding
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Complete database schema
├── types/
│   └── database.ts              # TypeScript type definitions
├── middleware.ts                # Role-based route protection
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── next.config.js               # Next.js configuration
└── README.md                    # Comprehensive documentation

```

## 🗄️ Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts | role, language, email |
| `seasons` | Basketball seasons | name, start_date, end_date, is_active |
| `teams` | Team roster | season_id, name |
| `players` | Player details | team_id, jersey_number, position |
| `parent_player_links` | Parent-child links | parent_id, player_id |
| `games` | Game records | **slot_a_user_id, slot_b_user_id**, status |
| `game_periods` | Quarters/OT | period_number, duration_ms |
| `stints` | Player minutes | clock_in_ms, clock_out_ms |
| `game_events` | All game actions | event_type, coords, zone, clock |
| `translations` | i18n strings | key (trke_*), locale, value |

## 🎯 Key Features Implemented

### ✅ Authentication & Authorization
- Supabase Auth with email/password
- Cookie-based session management
- Middleware route protection by role

### ✅ Role-Based Access Control
- 5 distinct user roles with separate dashboards
- RLS policies at database level
- Parent can only see linked children
- Player can only see own stats

### ✅ Admin Capabilities
- Create/edit seasons, teams, players
- User management (assign roles)
- Translation management
- View all games with Slot A/B status

### ✅ Internationalization
- EN, ES, CA language support
- All keys start with `trke_`
- Translation table seeded with 48 strings
- Language selector in user profile

### ✅ Game Model (Ready for Live Capture)
- Slot A/B user assignments
- Game status: scheduled → live → final
- Period tracking (4×10min quarters)
- Event capture with timestamps and zones

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Apply database migrations (use Supabase CLI or SQL Editor)
supabase db push
# OR manually copy/paste supabase/migrations/001_initial_schema.sql

# Seed database with demo data
npm run db:seed

# Start development server
npm run dev

# Build for production
npm run build
```

## 🔑 Demo Account Credentials

After seeding:

```
Admin:         oscar@basquet.local      / basquet2024
Team Manager:  manager@basquet.local    / basquet2024
Coach:         coach@basquet.local      / basquet2024
Parent:        parent@basquet.local     / basquet2024
Player:        player@basquet.local     / basquet2024
```

## 🎨 UI Pages by Role

### Admin Routes
- `/admin` - Dashboard with cards for all resources
- `/admin/seasons` - Season list
- `/admin/teams` - Team list
- `/admin/players` - Player roster
- `/admin/users` - User list with roles
- `/admin/games` - Game list with scores and status
- `/admin/translations` - i18n key management

### Team Manager Routes
- `/team-manager` - Game list with Slot A/B indicators
- Shows which games have operators assigned
- "Assign Slots" button for scheduled games

### Coach Routes
- `/coach` - Team roster with all players (read-only)

### Parent Routes
- `/parent` - Linked children only (RLS enforced)
- Can only see stats for their own child

### Player Routes
- `/player` - Personal profile and stats (RLS enforced)

## 🔒 Security Features

1. **Middleware Protection**: Unauthorized users redirected to login
2. **RLS Policies**: Database-level access control
3. **Parent Privacy**: Can't query other players' data
4. **Player Privacy**: Can't access other players' stats
5. **Session Cookies**: HTTP-only, secure session management

## 📋 Translation Convention

All UI strings must use `trke_` prefix:

```typescript
// Good examples
trke_login_title
trke_dashboard_players
trke_game_status_live

// Bad examples (don't use)
login_title
players
game_status
```

## 🎯 Phase 2 Prep (Already in Schema)

The database is ready for live capture:

- ✅ `slot_a_user_id` and `slot_b_user_id` on games
- ✅ `game_events` table with all event types
- ✅ Shot coordinates (x, y) and zones (1-4)
- ✅ Clock tracking (remaining_ms, elapsed_ms)
- ✅ Possession flags (is_offensive)
- ✅ Stint tracking for minutes played

## 📦 Dependencies

- **next**: 15.1.4
- **react**: 19.0.0
- **@supabase/supabase-js**: 2.39.0
- **typescript**: 5.x
- **tailwindcss**: 3.4.1

## 🧪 Testing the Foundation

1. **Build test**: `npm run build` ✅
2. **Login test**: Try all 5 demo accounts ✅
3. **Route protection**: Try accessing wrong role pages ✅
4. **Admin CRUD**: Create season/team/player ✅
5. **Parent RLS**: Verify can't see other children ✅
6. **Game slots**: Check games have A/B user fields ✅
7. **Translations**: View `/admin/translations` ✅

## 📝 Code Conventions

- English for all code and comments
- `trke_*` for all UI strings
- TypeScript strict mode enabled
- Tailwind for all styling
- No custom CSS modules

## 🚀 Deployment Guide

### Vercel + Supabase

1. Create Supabase project at supabase.com
2. Run migrations (CLI or SQL Editor)
3. Push code to GitHub
4. Import to Vercel
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Deploy
7. Run seed script to populate data

## 🎉 What's Working

- ✅ Full authentication system
- ✅ Role-based dashboards
- ✅ Admin can manage all resources
- ✅ RLS prevents unauthorized access
- ✅ i18n with 3 languages
- ✅ Game model with Slot A/B
- ✅ Ready for live capture integration
- ✅ Production-ready schema
- ✅ Comprehensive documentation

## 🔮 What's Next (Phase 2)

- Live game clock with start/pause
- Slot A UI: shots, fouls, subs
- Slot B UI: rebounds, assists, steals
- Half-court shot zone selector
- Supabase Realtime sync
- Possession tracking

---

**Foundation Status**: ✅ COMPLETE AND READY FOR PHASE 2
