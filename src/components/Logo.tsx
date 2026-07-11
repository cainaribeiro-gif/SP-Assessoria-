import React from "react";

interface LogoProps {
  iconClassName?: string;
  logoUrl?: string;
}

export function Logo({ iconClassName = "w-14 h-14", logoUrl }: LogoProps) {
  return (
    <div className={`relative ${iconClassName} rounded-full border border-brand-gold-500/40 bg-white flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105 shadow-xs shrink-0`}>
      {logoUrl ? (
        <img 
          src={logoUrl} 
          alt="SP Assessoria Logo" 
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain select-none"
        />
      ) : (
        /* SVG Vector replication of the SP circular logo with pillar */
        <svg viewBox="0 0 100 100" className="w-full h-full fill-none select-none">
          {/* Crescent Gold Arc (Thin elegant circle framing the S & P) */}
          <path 
            d="M 71 11 A 44 44 0 1 0 81 74" 
            stroke="#b38e46" 
            strokeWidth="2.2" 
            strokeLinecap="round" 
          />
          
          {/* S Text (Navy) - positioned high-left */}
          <text 
            x="46" 
            y="59" 
            fontSize="51" 
            fontFamily="'Cinzel', 'Georgia', 'Times New Roman', serif" 
            fontWeight="bold" 
            fill="#0f2340" 
            textAnchor="middle"
          >
            S
          </text>
          
          {/* P Text (Navy) - positioned low-right */}
          <text 
            x="74" 
            y="75" 
            fontSize="51" 
            fontFamily="'Cinzel', 'Georgia', 'Times New Roman', serif" 
            fontWeight="bold" 
            fill="#0f2340" 
            textAnchor="middle"
          >
            P
          </text>
          
          {/* Classic Column/Pillar of Law & Justice (Gold) at the bottom-left */}
          <g fill="#b38e46">
            {/* Capital Top (Stepped slabs) */}
            <rect x="23" y="63" width="22" height="2.5" rx="0.5" />
            <rect x="25" y="65.5" width="18" height="2.5" rx="0.5" />
            <rect x="26" y="68" width="16" height="2" rx="0.3" />
            
            {/* Pillars/Shafts (4 distinct elegant vertical columns) */}
            <rect x="27.5" y="70" width="2.2" height="15" />
            <rect x="31.5" y="70" width="2.2" height="15" />
            <rect x="35.5" y="70" width="2.2" height="15" />
            <rect x="39.5" y="70" width="2.2" height="15" />
            
            {/* Base (Support slabs) */}
            <rect x="24" y="85" width="20" height="2.5" rx="0.5" />
          </g>
        </svg>
      )}
    </div>
  );
}
