import React from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';

// Soft pulsing glow around the whole bottle.
const glowAnim = keyframes`
  0%, 100% { filter: drop-shadow(0 0 4px rgba(86,115,235,.4)); }
  50%      { filter: drop-shadow(0 0 11px rgba(86,115,235,.75)); }
`;

// Classic potion-bottle silhouette: rounded bulbous body, shoulders curving up to a
// narrow neck and mouth. Symmetric about x = 50 in a 0 0 100 140 viewBox.
const BOTTLE =
    'M43 28 L43 49 C41 61 15 65 15 90 C15 116 25 132 50 132 ' +
    'C75 132 85 116 85 90 C85 65 59 61 57 49 L57 28 Z';

const PotionLoader = ({ label = 'Brewing your lore…', minHeight = 160 }) => (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box
                component="svg"
                viewBox="0 0 100 140"
                sx={{ width: 84, height: 118, overflow: 'visible', animation: `${glowAnim} 2.2s ease-in-out infinite` }}
            >
                <defs>
                    <clipPath id="pl-bottle"><path d={BOTTLE} /></clipPath>
                    <linearGradient id="pl-liquid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#a6bcff" />
                        <stop offset="0.55" stopColor="#7494ff" />
                        <stop offset="1" stopColor="#5673eb" />
                    </linearGradient>
                    <linearGradient id="pl-glass" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="rgba(255,255,255,.4)" />
                        <stop offset="1" stopColor="rgba(255,255,255,.05)" />
                    </linearGradient>
                </defs>

                {/* glass body */}
                <path d={BOTTLE} fill="url(#pl-glass)" />

                {/* liquid, surface + bubbles, clipped to the bottle */}
                <g clipPath="url(#pl-bottle)">
                    <rect x="0" y="74" width="100" height="66" fill="url(#pl-liquid)" />
                    <rect x="0" y="73" width="100" height="2" fill="rgba(255,255,255,.6)" />
                    {[0, 1, 2, 3, 4].map((i) => {
                        const dur = `${1.6 + i * 0.2}s`;
                        return (
                            <circle key={i} cx={30 + i * 10} r={2 + (i % 2)} fill="rgba(255,255,255,.85)">
                                <animate attributeName="cy" values="126;80" dur={dur} begin={`${i * 0.15}s`} repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0;1;1;0" dur={dur} begin={`${i * 0.15}s`} repeatCount="indefinite" />
                            </circle>
                        );
                    })}
                    {/* glass highlight streak */}
                    <path d="M26 66 C23 90 26 114 34 128" stroke="rgba(255,255,255,.5)" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.6" />
                </g>

                {/* glass outline */}
                <path d={BOTTLE} fill="none" stroke="rgba(22,22,22,.4)" strokeWidth="3" strokeLinejoin="round" />

                {/* mouth lip + cork */}
                <rect x="37" y="21" width="26" height="9" rx="3" fill="rgba(250,250,250,.75)" stroke="rgba(22,22,22,.4)" strokeWidth="3" />
                <rect x="42" y="8" width="16" height="14" rx="2.5" fill="#7c5a2b" stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
            </Box>

            <Box
                sx={{
                    fontFamily: `'Cinzel', ui-serif, Georgia, serif`,
                    fontWeight: 700,
                    letterSpacing: '.3px',
                    fontSize: 13,
                    color: '#2e2a22',
                    textShadow: '0 1px 0 rgba(255,255,255,.5)',
                }}
            >
                {label}
            </Box>
        </Box>
    </Box>
);

export default PotionLoader;
