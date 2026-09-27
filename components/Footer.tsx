'use client';

import Image from 'next/image';

interface FooterProps {
  translations: Record<string, string>;
  version: string;
}

export function Footer({ translations, version }: FooterProps) {
  return (
    <footer className="bg-brand dark:bg-brand-dark text-white py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo and copyright */}
          <div className="flex items-center gap-4">
            <Image
              src="/images/seasonmath-logo.png"
              alt="SeasonMath"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-sm">
              {translations.trke_footer_copyright || '© 2026 SeasonMath'}
            </span>
          </div>

          {/* Support and version */}
          <div className="flex items-center gap-4 text-sm">
            <a
              href="mailto:support@seasonmath.com"
              className="hover:underline hover:opacity-80 transition-opacity"
            >
              {translations.trke_footer_support || 'support@seasonmath.com'}
            </a>
            <span className="text-white/70">
              {translations.trke_footer_version || 'v'}{version}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
