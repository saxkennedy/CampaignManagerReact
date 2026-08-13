import React from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';

// An uncorked bottle of something that shouldn't be drunk: oxblood brew going
// black at the dregs, embers wobbling up through it, and smoke curling off the
// mouth. Everything is SMIL/CSS on a single inline SVG — no assets, no canvas.

// Classic potion-bottle silhouette, symmetric about x = 50.
const BOTTLE =
    'M43 28 L43 49 C41 61 15 65 15 90 C15 116 25 132 50 132 ' +
    'C75 132 85 116 85 90 C85 65 59 61 57 49 L57 28 Z';

// Headroom above the mouth for smoke, and margin all round for the ambient glow.
const VIEW_BOX = '-26 -50 152 196';
const VIEW_RATIO = 196 / 152;

const LIQUID_TOP = 74;

// Embers rise along gently curved paths so they drift rather than track
// straight up. Each is a separate route to keep the motion from looking ranked.
const EMBER_PATHS = [
    'M30 128 C24 112 34 98 28 80',
    'M42 130 C48 114 38 98 44 78',
    'M52 129 C46 112 56 96 50 77',
    'M62 130 C68 116 58 100 64 79',
    'M72 128 C66 114 76 100 70 82',
    'M36 131 C40 118 32 106 38 90',
    'M46 131 C42 116 50 102 45 84',
    'M57 130 C62 117 54 103 59 85',
    'M67 131 C62 119 70 107 65 92',
    'M26 129 C31 117 24 106 29 94',
    'M76 130 C71 118 78 108 73 96',
];

// Smoke leaves the mouth and curls off to one side as it thins out.
const SMOKE_PATHS = [
    'M47 20 C40 4 52 -6 44 -22 C40 -30 46 -36 42 -44',
    'M50 18 C56 2 44 -8 52 -24 C56 -32 50 -38 54 -46',
    'M53 20 C60 6 50 -4 58 -20 C62 -28 56 -34 60 -42',
    'M45 20 C38 8 46 -2 38 -16 C34 -24 40 -30 36 -38',
    'M55 19 C62 8 54 0 62 -14 C66 -22 60 -28 64 -36',
    'M50 20 C48 4 52 -8 49 -26 C47 -34 51 -40 49 -48',
];

const glowAnim = keyframes`
  0%, 100% { filter: drop-shadow(0 0 7px rgba(190,40,28,.45)); }
  50%      { filter: drop-shadow(0 0 20px rgba(228,70,40,.85)); }
`;

// Rattling against an unseen surface: two bursts of jitter with a rest between,
// pivoting at the base so the bottle stays planted and the neck does the moving.
const rattleAnim = keyframes`
  0%   { transform: translate(0,0) rotate(0deg); }
  4%   { transform: translate(-0.7px,0) rotate(-0.8deg); }
  8%   { transform: translate(0.8px,-0.4px) rotate(0.9deg); }
  12%  { transform: translate(-0.6px,0.2px) rotate(-0.6deg); }
  16%  { transform: translate(0.5px,-0.2px) rotate(0.5deg); }
  20%  { transform: translate(-0.3px,0) rotate(-0.3deg); }
  24%  { transform: translate(0,0) rotate(0deg); }
  46%  { transform: translate(0,0) rotate(0deg); }
  50%  { transform: translate(0.9px,-0.5px) rotate(1deg); }
  54%  { transform: translate(-1px,0.3px) rotate(-1.1deg); }
  58%  { transform: translate(0.7px,-0.3px) rotate(0.7deg); }
  62%  { transform: translate(-0.5px,0.1px) rotate(-0.5deg); }
  66%  { transform: translate(0.3px,0) rotate(0.3deg); }
  70%  { transform: translate(0,0) rotate(0deg); }
  100% { transform: translate(0,0) rotate(0deg); }
`;

// The halo breathes with the ember glow.
const haloAnim = keyframes`
  0%, 100% { opacity: .55; transform: scale(0.94); }
  50%      { opacity: 1;   transform: scale(1.04); }
`;

let uid = 0;

const PotionLoader = ({
    label = 'Brewing your lore…',
    minHeight = 280,
    size = 190,
    labelColor = '#2e2a22',
    labelShadow = '0 1px 0 rgba(255,255,255,.5)', // letterpress; pass 'none' on dark
}) => {
    // Namespaced so two loaders on one page can't steal each other's defs.
    const id = React.useMemo(() => `pl${++uid}`, []);

    return (
        <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
                <Box
                    component="svg"
                    viewBox={VIEW_BOX}
                    sx={{
                        width: size,
                        maxWidth: '100%',
                        height: size * VIEW_RATIO,
                        overflow: 'visible',
                        animation: `${glowAnim} 2.4s ease-in-out infinite`,
                        '@media (prefers-reduced-motion: reduce)': {
                            animation: 'none',
                            '& *': { animation: 'none !important' },
                        },
                    }}
                >
                    <defs>
                        <clipPath id={`${id}-clip`}><path d={BOTTLE} /></clipPath>

                        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="rgba(255,255,255,.18)" />
                            <stop offset="0.55" stopColor="rgba(255,255,255,.05)" />
                            <stop offset="1" stopColor="rgba(120,180,160,.10)" />
                        </linearGradient>

                        {/* oxblood at the surface, near-black in the dregs */}
                        <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#a52328" />
                            <stop offset="0.45" stopColor="#5a0d15" />
                            <stop offset="1" stopColor="#140206" />
                        </linearGradient>

                        {/* something down there is still hot */}
                        <radialGradient id={`${id}-heat`} cx="0.5" cy="0.92" r="0.55">
                            <stop offset="0" stopColor="rgba(255,120,60,.6)" />
                            <stop offset="1" stopColor="rgba(255,120,60,0)" />
                        </radialGradient>

                        {/* soft edge on the smoke so it doesn't read as string */}
                        <filter id={`${id}-haze`} x="-60%" y="-60%" width="220%" height="220%">
                            <feGaussianBlur stdDeviation="1.6" />
                        </filter>

                        {/* ambient light thrown off the brew */}
                        <radialGradient id={`${id}-ambient`}>
                            <stop offset="0" stopColor="rgba(255,86,40,.30)" />
                            <stop offset="0.5" stopColor="rgba(206,52,30,.13)" />
                            <stop offset="1" stopColor="rgba(160,40,25,0)" />
                        </radialGradient>
                        <radialGradient id={`${id}-pool`}>
                            <stop offset="0" stopColor="rgba(255,124,60,.40)" />
                            <stop offset="1" stopColor="rgba(255,124,60,0)" />
                        </radialGradient>
                    </defs>

                    {/* ---- ambient glow: stays put while the bottle rattles ---- */}
                    <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `${haloAnim} 2.4s ease-in-out infinite` }}>
                        <ellipse cx="50" cy="94" rx="72" ry="78" fill={`url(#${id}-ambient)`} />
                    </g>
                    {/* light pooling on a surface we never draw */}
                    <ellipse cx="50" cy="134" rx="48" ry="10" fill={`url(#${id}-pool)`}>
                        <animate attributeName="rx" values="48;54;48" dur="2.4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values=".7;1;.7" dur="2.4s" repeatCount="indefinite" />
                    </ellipse>

                    {/* ---- the bottle, rattling on the spot ---- */}
                    <g
                        style={{
                            transformBox: 'fill-box',
                            transformOrigin: '50% 96%',
                            animation: `${rattleAnim} 3.6s ease-in-out infinite`,
                        }}
                    >
                    {/* ---- contents, clipped to the glass ---- */}
                    <g clipPath={`url(#${id}-clip)`}>
                        <rect x="0" y={LIQUID_TOP} width="100" height="70" fill={`url(#${id}-liquid)`} />

                        {/* surface: a slow swell rather than a flat band */}
                        <ellipse cx="50" cy={LIQUID_TOP} rx="40" ry="3.2" fill="#b02a2c" opacity="0.85">
                            <animate attributeName="ry" values="3.2;4.6;3.2" dur="4.2s" repeatCount="indefinite" />
                            <animate attributeName="cy" values="74;72.6;74" dur="4.2s" repeatCount="indefinite" />
                        </ellipse>
                        <ellipse cx="50" cy={LIQUID_TOP - 0.6} rx="34" ry="1.6" fill="rgba(255,150,110,.55)">
                            <animate attributeName="rx" values="34;28;34" dur="4.2s" repeatCount="indefinite" />
                        </ellipse>

                        <rect x="0" y={LIQUID_TOP} width="100" height="70" fill={`url(#${id}-heat)`} />

                        {/* sediment */}
                        <ellipse cx="50" cy="126" rx="30" ry="8" fill="rgba(10,2,4,.75)" />

                        {/* slow roil */}
                        {[0, 1, 2].map((i) => (
                            <ellipse key={`roil${i}`} cx={34 + i * 16} cy={94 + (i % 2) * 16} rx="13" ry="4.5" fill="rgba(255,90,50,.16)">
                                <animate attributeName="rx" values="9;17;9" dur={`${3.4 + i * 0.5}s`} begin={`${i * 0.7}s`} repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0;.45;0" dur={`${3.4 + i * 0.5}s`} begin={`${i * 0.7}s`} repeatCount="indefinite" />
                            </ellipse>
                        ))}

                        {/* embers drifting up their own routes, swelling as pressure drops */}
                        {EMBER_PATHS.map((p, i) => {
                            const dur = `${2.6 + i * 0.42}s`;
                            const begin = `${i * 0.36}s`;
                            return (
                                <circle key={`e${i}`} r={1.3 + (i % 3) * 0.5} fill={i % 2 ? '#ff9a5c' : '#e0452b'}>
                                    <animateMotion path={p} dur={dur} begin={begin} repeatCount="indefinite" />
                                    <animate attributeName="r" values={`${1.3 + (i % 3) * 0.5};${2.4 + (i % 3) * 0.5}`} dur={dur} begin={begin} repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0;.95;.95;0" keyTimes="0;.15;.75;1" dur={dur} begin={begin} repeatCount="indefinite" />
                                </circle>
                            );
                        })}

                        {/* cold highlight down the glass, inside the fill */}
                        <path d="M26 66 C23 90 26 114 34 128" stroke="rgba(255,255,255,.16)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    </g>

                    {/* ---- the glass itself ---- */}
                    <path d={BOTTLE} fill={`url(#${id}-glass)`} />
                    <path d={BOTTLE} fill="none" stroke="rgba(8,6,4,.75)" strokeWidth="3" strokeLinejoin="round" />
                    {/* faint sickly rim on the right edge */}
                    <path d="M85 90 C85 116 75 132 50 132" fill="none" stroke="rgba(150,220,180,.22)" strokeWidth="2" strokeLinecap="round" />

                    {/* mouth, uncorked */}
                    <rect x="37" y="21" width="26" height="9" rx="3" fill="#3a342a" stroke="rgba(8,6,4,.75)" strokeWidth="3" />

                    {/* ---- smoke off the mouth ---- */}
                    <g filter={`url(#${id}-haze)`}>
                        {SMOKE_PATHS.map((p, i) => (
                            <path
                                key={`s${i}`}
                                d={p}
                                fill="none"
                                stroke="rgba(196,158,96,.55)"
                                strokeWidth={2.4 - i * 0.3}
                                strokeLinecap="round"
                                strokeDasharray="70"
                            >
                                <animate attributeName="stroke-dashoffset" values="70;-70" dur={`${5 + i * 1.1}s`} begin={`${i * 1.3}s`} repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0;.75;.5;0" keyTimes="0;.25;.6;1" dur={`${5 + i * 1.1}s`} begin={`${i * 1.3}s`} repeatCount="indefinite" />
                            </path>
                        ))}
                    </g>

                    {/* sparks escaping with the smoke */}
                    {[0, 1, 2, 3].map((i) => (
                        <circle key={`sp${i}`} r={0.9 + (i % 2) * 0.4} fill="#ffb27a">
                            <animateMotion path={SMOKE_PATHS[i]} dur={`${3.6 + i * 0.7}s`} begin={`${0.8 + i * 1.1}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0;.9;0" dur={`${3.6 + i * 0.7}s`} begin={`${0.8 + i * 1.1}s`} repeatCount="indefinite" />
                        </circle>
                    ))}
                    </g>
                </Box>

                <Box
                    sx={{
                        fontFamily: `'Cinzel', ui-serif, Georgia, serif`,
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        fontSize: 14,
                        color: labelColor,
                        textShadow: labelShadow,
                    }}
                >
                    {label}
                </Box>
            </Box>
        </Box>
    );
};

export default PotionLoader;
