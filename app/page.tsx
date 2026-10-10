import fs from 'fs';
import path from 'path';
import Image from 'next/image';
import Link from 'next/link';
import { SeasonMathLogo } from '@/components/SeasonMathLogo';

const SHOTS = {
  hero: 'hero',
  capture: 'capture',
  club: 'club',
  season: 'season',
} as const;

function landingImage(name: string) {
  for (const ext of ['jpg', 'jpeg', 'webp', 'png']) {
    const relative = path.join('images', 'landing', `${name}.${ext}`);
    if (fs.existsSync(path.join(process.cwd(), 'public', relative))) {
      return `/${relative.split(path.sep).join('/')}`;
    }
  }
  return null;
}

function SignInLink({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={`inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 font-display text-sm text-white shadow-sm transition-colors hover:bg-brand-dark ${className}`}
    >
      Sign in
    </Link>
  );
}

function Shot({
  src,
  alt,
  priority = false,
  sizes,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#12315f] shadow-sm">
      {src ? (
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
      ) : (
        <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden>
          <rect width="400" height="300" fill="#12315f" />
          <rect x="22" y="22" width="356" height="256" fill="none" stroke="#f4a261" strokeWidth="2" opacity="0.7" />
          <line x1="200" y1="22" x2="200" y2="278" stroke="#f4a261" strokeWidth="2" opacity="0.7" />
          <circle cx="200" cy="150" r="38" fill="none" stroke="#f4a261" strokeWidth="2" opacity="0.85" />
          <circle cx="200" cy="150" r="4" fill="#e4570f" />
          <path d="M22 96 H108 V204 H22" fill="none" stroke="#f4a261" strokeWidth="2" opacity="0.7" />
          <path d="M378 96 H292 V204 H378" fill="none" stroke="#f4a261" strokeWidth="2" opacity="0.7" />
        </svg>
      )}
    </div>
  );
}

export default function HomePage() {
  const hero = landingImage(SHOTS.hero);
  const capture = landingImage(SHOTS.capture);
  const club = landingImage(SHOTS.club);
  const season = landingImage(SHOTS.season);

  return (
    <div className="bg-[#f4f6fb] text-[#10233f] dark:bg-[#0b1220] dark:text-white">
      <header className="border-b border-[#10233f]/10 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <SeasonMathLogo width={160} height={160} priority className="h-16 w-16" />
          <SignInLink />
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-20">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-brand dark:text-orange-300">
              For the club
            </p>
            <h1 className="mt-3 max-w-xl text-4xl leading-tight sm:text-5xl">
              Every possession has a place.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#10233f]/80 dark:text-white/80">
              SeasonMath is the sideline book for a basketball club. The live game, the people
              around it, and the season sit in one account. Replace this paragraph with yours.
            </p>
            <div className="mt-8">
              <SignInLink className="px-6" />
            </div>
          </div>
          <Shot src={hero} alt="" priority sizes="(min-width: 1024px) 50vw, 100vw" />
        </section>

        <section className="border-t border-[#10233f]/10 bg-white dark:border-white/10 dark:bg-[#10192b]">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:px-6">
            <article className="grid items-center gap-8 lg:grid-cols-2">
              <Shot src={capture} alt="" sizes="(min-width: 1024px) 40vw, 100vw" />
              <div>
                <h2 className="text-3xl">Mark it while it happens</h2>
                <p className="mt-4 text-lg leading-relaxed text-[#10233f]/80 dark:text-white/80">
                  Shots, fouls, substitutions, and the clock, from the bench. The sheet stays
                  with the game. This line is a stand-in.
                </p>
              </div>
            </article>

            <article className="grid items-center gap-8 lg:grid-cols-2">
              <Shot src={club} alt="" sizes="(min-width: 1024px) 40vw, 100vw" />
              <div className="lg:order-first">
                <h2 className="text-3xl">One club, the right door</h2>
                <p className="mt-4 text-lg leading-relaxed text-[#10233f]/80 dark:text-white/80">
                  Coaches, managers, parents, and players each open their own view. The numbers
                  stay in one place. Swap this copy when you have it.
                </p>
              </div>
            </article>

            <article className="grid items-center gap-8 lg:grid-cols-2">
              <Shot src={season} alt="" sizes="(min-width: 1024px) 40vw, 100vw" />
              <div>
                <h2 className="text-3xl">The season, added up</h2>
                <p className="mt-4 text-lg leading-relaxed text-[#10233f]/80 dark:text-white/80">
                  One game is a page. The season is the sum. SeasonMath keeps both. Replace this
                  with the line you want visitors to remember.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="max-w-xl text-3xl">Already with a club? Sign in.</h2>
          <SignInLink className="px-6" />
        </section>
      </main>
    </div>
  );
}
