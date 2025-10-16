import React from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';

// D&D-themed bubbling potion loader
const bubbleAnim = keyframes`
  0%   { transform: translateY(12px) scale(0.6); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateY(-46px) scale(1); opacity: 0; }
`;
const glowAnim = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(86, 115, 235, .35), inset 0 0 12px rgba(86,115,235,.25); }
  50%      { box-shadow: 0 0 18px rgba(86,115,235,.55), inset 0 0 22px rgba(86,115,235,.45); }
`;

const PotionLoader = ({ label = 'Brewing your lore…', minHeight = 160 }) => (
    <Box
        sx={{
            width: '100%',
            minHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1.5,
        }}
    >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            {/* Bottle */}
            <Box
                sx={{
                    position: 'relative',
                    width: 92,
                    height: 116,
                    borderRadius: '0 0 38px 38px',
                    border: '3px solid rgba(22,22,22,.35)',
                    background:
                        'linear-gradient(180deg, rgba(255,255,255,.25) 0%, rgba(255,255,255,.05) 40%, rgba(255,255,255,0) 100%)',
                    overflow: 'hidden',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: -16,
                        width: 40,
                        height: 20,
                        border: '3px solid rgba(22,22,22,.35)',
                        borderBottom: 'none',
                        borderRadius: '8px 8px 0 0',
                        background: 'rgba(250,250,250,.55)',
                    },
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: -28,
                        width: 28,
                        height: 14,
                        borderRadius: '4px',
                        background: '#7c5a2b',
                        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.2)',
                    },
                    animation: `${glowAnim} 2.2s ease-in-out infinite`,
                }}
            >
                {/* Liquid */}
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: '56%',
                        background:
                            'radial-gradient(60% 70% at 50% 0%, rgba(160,190,255,.85) 0%, rgba(116,148,255,.9) 55%, rgba(86,115,235,.95) 100%)',
                        borderTop: '2px solid rgba(255,255,255,.6)',
                    }}
                />
                {/* Bubbles */}
                {[0, 1, 2, 3, 4].map((i) => (
                    <Box
                        key={i}
                        sx={{
                            position: 'absolute',
                            bottom: 18,
                            left: `${18 + i * 14}%`,
                            width: 8 + (i % 2) * 2,
                            height: 8 + (i % 2) * 2,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,.85)',
                            filter: 'blur(0.2px)',
                            animation: `${bubbleAnim} ${1.6 + i * 0.18}s ease-in infinite`,
                            animationDelay: `${i * 0.12}s`,
                        }}
                    />
                ))}
                {/* Tiny sparkles */}
                {[0, 1, 2].map((i) => (
                    <Box
                        key={`spark-${i}`}
                        sx={{
                            position: 'absolute',
                            top: `${18 + i * 22}%`,
                            right: `${10 + i * 18}%`,
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'rgba(200,220,255,.9)',
                            boxShadow: '0 0 10px rgba(140,170,255,.9)',
                            opacity: 0.75,
                        }}
                    />
                ))}
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
