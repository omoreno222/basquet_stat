'use client';

interface BasketballCourtProps {
  onCourtTap?: (x: number, y: number) => void;
  shotMarkers?: Array<{
    id: string;
    x: number;
    y: number;
    made: boolean;
    points: number;
  }>;
  className?: string;
  attackingRight?: boolean;
  isOffense?: boolean;
}

export function BasketballCourt({ 
  onCourtTap, 
  shotMarkers = [], 
  className = '',
  attackingRight = true,
  isOffense = true,
}: BasketballCourtProps) {
  const handleClick = (e: React.MouseEvent<SVGElement>) => {
    if (!onCourtTap) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const worldX = (e.clientX - rect.left) / rect.width;
    const worldY = (e.clientY - rect.top) / rect.height;

    onCourtTap(worldX, worldY);
  };

  const highlightRight = isOffense ? attackingRight : !attackingRight;

  return (
    <svg
      viewBox="0 0 1000 470"
      className={`w-full h-full ${className}`}
      onClick={handleClick}
      style={{ cursor: onCourtTap ? 'pointer' : 'default' }}
    >
      <defs>
        {/* Wood plank pattern - horizontal planks */}
        <pattern id="woodPlank" x="0" y="0" width="100" height="20" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100" height="20" fill="#d4a574"/>
          <rect x="0" y="0" width="100" height="1" fill="#c89960" opacity="0.3"/>
          <rect x="0" y="19" width="100" height="1" fill="#b8925e" opacity="0.4"/>
          <line x1="0" y1="10" x2="100" y2="10" stroke="#c89960" strokeWidth="0.3" opacity="0.2"/>
        </pattern>
        
        {/* Wood grain texture overlay */}
        <pattern id="woodGrain" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
          <rect width="200" height="200" fill="url(#woodPlank)"/>
          {/* Vertical plank seams */}
          <line x1="50" y1="0" x2="50" y2="200" stroke="#b8925e" strokeWidth="1" opacity="0.3"/>
          <line x1="100" y1="0" x2="100" y2="200" stroke="#b8925e" strokeWidth="1" opacity="0.3"/>
          <line x1="150" y1="0" x2="150" y2="200" stroke="#b8925e" strokeWidth="1" opacity="0.3"/>
          {/* Subtle grain variation */}
          <rect x="0" y="0" width="50" height="200" fill="#c89960" opacity="0.05"/>
          <rect x="100" y="0" width="50" height="200" fill="#b8925e" opacity="0.05"/>
        </pattern>

        {/* Active half highlight overlay (semi-transparent) */}
        <pattern id="activeHighlight" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="#fff" opacity="0.08"/>
        </pattern>

        {/* Paint area tint (SeasonMath orange) */}
        <linearGradient id="paintTint" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.15"/>
          <stop offset="50%" stopColor="#f97316" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.15"/>
        </linearGradient>
      </defs>

      {/* Court background - hardwood floor */}
      <rect x="0" y="0" width="1000" height="470" fill="url(#woodGrain)" />
      
      {/* Left half active highlight */}
      {!highlightRight && (
        <rect x="10" y="10" width="490" height="450" fill="url(#activeHighlight)" />
      )}
      
      {/* Right half active highlight */}
      {highlightRight && (
        <rect x="500" y="10" width="490" height="450" fill="url(#activeHighlight)" />
      )}
      
      {/* Full court outline - crisp white */}
      <rect x="10" y="10" width="980" height="450" fill="none" stroke="#ffffff" strokeWidth="3" />
      
      {/* Center line - crisp white */}
      <line x1="500" y1="10" x2="500" y2="460" stroke="#ffffff" strokeWidth="3" />
      
      {/* Center circle - white */}
      <circle cx="500" cy="235" r="55" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      
      {/* LEFT BASKET HALF */}
      
      {/* Paint/Key - tinted */}
      <rect x="10" y="160" width="178" height="150" fill="url(#paintTint)" />
      <rect x="10" y="160" width="178" height="150" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      
      {/* Free throw line - white */}
      <line x1="188" y1="160" x2="188" y2="310" stroke="#ffffff" strokeWidth="2.5" />
      
      {/* Free throw circle - white */}
      <path
        d="M 188 205 A 55 55 0 0 0 188 265"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
      />
      
      {/* Restricted area semicircle */}
      <path
        d="M 35 205 A 30 30 0 0 0 35 265"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
      />
      
      {/* 3-point line - left basket - white */}
      <line x1="10" y1="88" x2="88" y2="88" stroke="#ffffff" strokeWidth="2.5" />
      <line x1="10" y1="382" x2="88" y2="382" stroke="#ffffff" strokeWidth="2.5" />
      
      {/* 3-point arc */}
      <path
        d="M 88 88 Q 10 165 10 235 Q 10 305 88 382"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
      />
      
      {/* Basket/hoop - left */}
      <circle cx="25" cy="235" r="8" fill="none" stroke="#ff4444" strokeWidth="2.5" />
      <line x1="18" y1="235" x2="10" y2="235" stroke="#ffffff" strokeWidth="2" />
      
      {/* Backboard - left */}
      <line x1="10" y1="205" x2="10" y2="265" stroke="#ffffff" strokeWidth="4" />
      
      {/* RIGHT BASKET HALF */}
      
      {/* Paint/Key - tinted */}
      <rect x="812" y="160" width="178" height="150" fill="url(#paintTint)" />
      <rect x="812" y="160" width="178" height="150" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      
      {/* Free throw line - white */}
      <line x1="812" y1="160" x2="812" y2="310" stroke="#ffffff" strokeWidth="2.5" />
      
      {/* Free throw circle - white */}
      <path
        d="M 812 205 A 55 55 0 0 1 812 265"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
      />
      
      {/* Restricted area semicircle */}
      <path
        d="M 965 205 A 30 30 0 0 1 965 265"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
      />
      
      {/* 3-point line - right basket - white */}
      <line x1="912" y1="88" x2="990" y2="88" stroke="#ffffff" strokeWidth="2.5" />
      <line x1="912" y1="382" x2="990" y2="382" stroke="#ffffff" strokeWidth="2.5" />
      
      {/* 3-point arc */}
      <path
        d="M 912 88 Q 990 165 990 235 Q 990 305 912 382"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
      />
      
      {/* Basket/hoop - right */}
      <circle cx="975" cy="235" r="8" fill="none" stroke="#ff4444" strokeWidth="2.5" />
      <line x1="982" y1="235" x2="990" y2="235" stroke="#ffffff" strokeWidth="2" />
      
      {/* Backboard - right */}
      <line x1="990" y1="205" x2="990" y2="265" stroke="#ffffff" strokeWidth="4" />
      
      {/* Shot markers - enhanced visibility on wood */}
      {shotMarkers.map((marker) => {
        const markerX = 10 + marker.x * 980;
        const markerY = 10 + marker.y * 450;
        const color = marker.made ? '#10b981' : '#ef4444';
        
        return (
          <g key={marker.id}>
            {/* Outer glow for visibility on wood */}
            <circle
              cx={markerX}
              cy={markerY}
              r="11"
              fill="#000"
              opacity="0.3"
            />
            {/* Main marker */}
            <circle
              cx={markerX}
              cy={markerY}
              r="9"
              fill={color}
              opacity="0.95"
              stroke="#fff"
              strokeWidth="2"
            />
            {/* Point value */}
            <text
              x={markerX}
              y={markerY + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize="11"
              fontWeight="bold"
              style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
            >
              {marker.points}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
