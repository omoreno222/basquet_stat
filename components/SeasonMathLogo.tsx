import Image from 'next/image';

interface SeasonMathLogoProps {
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

/** Light theme uses darker bar fills so the mark holds up on pale surfaces. */
export function SeasonMathLogo({ width, height, className = '', priority = false }: SeasonMathLogoProps) {
  return (
    <>
      <Image
        src="/images/seasonmath-logo-light.png"
        alt="SeasonMath"
        width={width}
        height={height}
        priority={priority}
        className={`${className} dark:hidden`}
      />
      <Image
        src="/images/seasonmath-logo.png"
        alt=""
        width={width}
        height={height}
        aria-hidden
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
