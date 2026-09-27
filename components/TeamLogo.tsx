import Image from 'next/image';

interface TeamLogoProps {
  logoUrl?: string | null;
  teamName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function TeamLogo({ logoUrl, teamName, size = 'md', className = '' }: TeamLogoProps) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-10 h-10 text-sm',
    md: 'w-16 h-16 text-base',
    lg: 'w-24 h-24 text-xl',
  };

  const sizePixels = {
    xs: 24,
    sm: 40,
    md: 64,
    lg: 96,
  };

  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const baseClasses = `${sizeClasses[size]} rounded-lg flex items-center justify-center font-bold overflow-hidden`;
  const fullClasses = `${baseClasses} ${className}`;

  if (logoUrl) {
    return (
      <div className={fullClasses}>
        <Image
          src={logoUrl}
          alt={`${teamName} logo`}
          width={sizePixels[size]}
          height={sizePixels[size]}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback to initials
  const initials = getInitials(teamName);
  return (
    <div className={`${fullClasses} bg-gradient-to-br from-blue-500 to-blue-700 text-white`}>
      {initials}
    </div>
  );
}
