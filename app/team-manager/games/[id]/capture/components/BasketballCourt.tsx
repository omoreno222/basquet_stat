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
}

export function BasketballCourt({ onCourtTap, shotMarkers = [], className = '' }: BasketballCourtProps) {
  const handleClick = (e: React.MouseEvent<SVGElement>) => {
    if (!onCourtTap) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    onCourtTap(x, y);
  };

  return (
    <svg
      viewBox="0 0 500 470"
      className={`w-full h-full ${className}`}
      onClick={handleClick}
      style={{ cursor: onCourtTap ? 'pointer' : 'default' }}
    >
      {/* Court background */}
      <rect x="0" y="0" width="500" height="470" fill="#1f2937" />
      
      {/* Half court outline */}
      <rect x="10" y="10" width="480" height="450" fill="none" stroke="#f97316" strokeWidth="3" />
      
      {/* Center/baseline */}
      <line x1="10" y1="235" x2="490" y2="235" stroke="#f97316" strokeWidth="2" />
      
      {/* Paint/Key - FIBA dimensions (16ft width, 19ft length from baseline) */}
      <rect x="175" y="10" width="150" height="178" fill="none" stroke="#f97316" strokeWidth="2" />
      
      {/* Free throw line */}
      <line x1="175" y1="188" x2="325" y2="188" stroke="#f97316" strokeWidth="2" />
      
      {/* Free throw circle (top half) */}
      <circle cx="250" cy="188" r="55" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="0 173" />
      <path
        d="M 195 188 A 55 55 0 0 1 305 188"
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
      />
      
      {/* Restricted area semicircle under basket */}
      <path
        d="M 220 35 A 30 30 0 0 1 280 35"
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
      />
      
      {/* 3-point line - FIBA (6.75m = ~22.15ft arc, 6.60m corner) */}
      {/* Corner 3s (straight lines parallel to sideline) */}
      <line x1="10" y1="10" x2="10" y2="88" stroke="#f97316" strokeWidth="2.5" />
      <line x1="490" y1="10" x2="490" y2="88" stroke="#f97316" strokeWidth="2.5" />
      
      {/* 3-point arc */}
      <path
        d="M 10 88 Q 85 10 250 10 Q 415 10 490 88"
        fill="none"
        stroke="#f97316"
        strokeWidth="2.5"
      />
      
      {/* Basket/hoop */}
      <circle cx="250" cy="25" r="8" fill="none" stroke="#ef4444" strokeWidth="2" />
      <line x1="250" y1="10" x2="250" y2="18" stroke="#fff" strokeWidth="1.5" />
      
      {/* Backboard */}
      <line x1="220" y1="10" x2="280" y2="10" stroke="#fff" strokeWidth="3" />
      
      {/* Shot markers */}
      {shotMarkers.map((marker) => {
        const markerX = 10 + marker.x * 480;
        const markerY = 10 + marker.y * 450;
        const color = marker.made ? '#10b981' : '#ef4444';
        
        return (
          <g key={marker.id}>
            <circle
              cx={markerX}
              cy={markerY}
              r="8"
              fill={color}
              opacity="0.8"
              stroke="#fff"
              strokeWidth="1.5"
            />
            <text
              x={markerX}
              y={markerY + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize="10"
              fontWeight="bold"
            >
              {marker.points}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
