import React from 'react';
import { Box, Paper, Typography, Stack, Divider } from '@mui/material';
import { soulslike as s, displayFont } from '../theme/soulslike';
import { ROOM_COLORS, KIND_COLORS } from './bastion/bastionGeometry';

// What's new, newest first. Each entry carries a legend key and a swatch in one of the
// builder's own room colors — the same device the release introduces, so the panel
// shows the feature while it describes it. Add a new object to the top for the next
// release; nothing else needs touching.
const RELEASES = [
    {
        name: 'The Bastioneering Update',
        date: '10 September 2026',
        dek: 'Your bastion map can now explain itself — and leave the app as a Roll20 background that drops straight onto the grid.',
        entries: [
            {
                key: 'A',
                color: ROOM_COLORS[3],
                title: 'Export your bastion for Roll20',
                body: [
                    'Hit “Export…” to save the floor you are looking at as a PNG. Take the whole map, or crop just part of it — hold Shift while dragging to keep the crop square, Esc to back out. The crop always snaps to whole squares.',
                    'Then it tells you exactly how to set up the Roll20 page: something like 120 ft × 90 ft, at 5 ft per square. Enter those numbers, drop the image in as the background, and it lines up cell for cell — no stretching. You pick where the file saves.',
                ],
            },
            {
                key: 'B',
                color: ROOM_COLORS[0],
                title: 'Add a legend to your map',
                body: [
                    'Under the new Settings button, turn on “Show legend”. Facility rooms get lettered keys — A, B, C — and their full names move into a legend box, each with a little color swatch so a row is easy to match to a block on the map.',
                    'Drag the legend wherever you like and pull its corner to resize it. There is a transparency slider too, so it can sit over the map without hiding it. Where you leave it is where it stays, for everyone.',
                ],
            },
            {
                key: 'C',
                color: KIND_COLORS.stairs,
                hatched: true,
                title: 'Number your stairs and hallways',
                body: [
                    'Turn on “Include stairs” and “Include hallways” to add them to the legend as 1, 2, 3 — counted stairs first. They only ever show a number on the map, and only while the legend is on, so your corridors stay uncluttered.',
                ],
            },
            {
                key: 'D',
                color: ROOM_COLORS[4],
                title: "See who's stationed where",
                body: [
                    'Rooms with hirelings now show a small figure in one of their squares. Hover it to read the names, with anyone currently away marked as such. A badge appears when more than one person is posted there.',
                ],
            },
            {
                key: 'E',
                color: ROOM_COLORS[2],
                title: 'A log of what everyone did',
                body: [
                    'DMs get a Log button on each turn segment: a per-player summary of turns and long rests spent, which rooms they leaned on most, and the actions behind those totals, broken down by character.',
                ],
            },
            {
                key: 'F',
                color: ROOM_COLORS[5],
                title: 'Room names that actually fit',
                body: [
                    'Longer names now wrap onto a second line when there is room for them — a 4×4 Artificer’s Forge reads properly at last. Names still too long for their room keep the short form, which is what hover and the legend are there for.',
                ],
            },
        ],
        improved: [
            ['Rooms always snap to the grid now.', 'Moving a room and dropping it back on the square it started from used to leave it sitting slightly off the lines.'],
            ['Labels sit properly in the middle.', 'Names in evenly sized rooms were drifting half a square up and to the left.'],
            ['Bigger windows.', 'Hirelings, segments, activities and the log now use the screen instead of a small box floating in the middle of it.'],
            ['Hide the grid lines.', 'Under Settings, whenever you want a cleaner look at the rooms themselves.'],
            ['A scissors cursor while cropping,', 'so it is obvious what a drag is about to do.'],
        ],
        next: 'Coming next: better action economy tracking, fuller support on phones and tablets, and images of your own — as room backgrounds in place of flat colors, and dropped onto the map for the likes of beds, cauldrons and chests.',
    },
];

const eyebrowSx = {
    fontFamily: displayFont,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.32em',
    textTransform: 'uppercase',
    color: s.gold,
};

const sectionHeadingSx = {
    fontFamily: displayFont,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: s.gold,
    mb: 2,
};

// The swatch mirrors how the element is painted on the board: its fill, plus the
// diagonal hatch that marks stairs.
const Swatch = ({ children, color, hatched }) => (
    <Box
        aria-hidden
        sx={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: '5px',
            bgcolor: color,
            border: '1px solid rgba(0,0,0,0.45)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.55)',
            ...(hatched && {
                backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(0,0,0,0.42) 0 2px, transparent 2px 7px)',
            }),
        }}
    >
        {children}
    </Box>
);

export default function ReleaseNotes() {
    return (
        // A tenth of the viewport clear on each side once there is room for it;
        // narrow screens keep a plain gutter instead.
        <Box sx={{ px: { xs: 1.5, sm: 3, md: '10%' }, pb: 8, display: 'flex', justifyContent: 'center' }}>
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    // Translucent, so the dashboard art carries on behind the panel
                    // rather than being boxed off by it.
                    background: `linear-gradient(180deg, rgba(28,24,17,0.93) 0%, rgba(20,17,12,0.95) 55%, rgba(11,10,8,0.96) 100%)`,
                    backdropFilter: 'blur(3px)',
                    border: `1px solid ${s.edge}`,
                    borderRadius: '14px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.55)',
                    px: { xs: 2.5, sm: 5 },
                    py: { xs: 3, sm: 5 },
                }}
            >
                {RELEASES.map((r, ri) => (
                    <Box key={r.name} sx={{ mt: ri === 0 ? 0 : 6 }}>
                        {/* masthead */}
                        <Typography sx={eyebrowSx}>What&rsquo;s New</Typography>
                        <Typography
                            component="h2"
                            sx={{
                                mt: 1,
                                fontFamily: displayFont,
                                fontWeight: 900,
                                lineHeight: 1.1,
                                fontSize: { xs: '1.9rem', sm: '2.6rem' },
                                background: `linear-gradient(180deg, ${s.goldPale} 0%, ${s.goldBright} 45%, #b8862f 100%)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            {r.name}
                        </Typography>
                        <Typography sx={{ mt: 1.5, color: s.vellum, fontSize: 18, lineHeight: 1.6 }}>
                            {r.dek}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 2 }}>
                            <Typography sx={{ color: s.parchment, fontSize: 13, letterSpacing: '0.08em' }}>
                                {r.date}
                            </Typography>
                            <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${s.edge}, transparent)` }} />
                        </Stack>

                        {/* the legend of what changed */}
                        <Box sx={{ mt: 4.5 }}>
                            <Stack spacing={3.5}>
                                {r.entries.map((e) => (
                                    <Stack key={e.key} direction="row" spacing={2.5} alignItems="flex-start">
                                        <Swatch color={e.color} hatched={e.hatched}>{e.key}</Swatch>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography
                                                component="h3"
                                                sx={{
                                                    fontFamily: displayFont,
                                                    fontWeight: 700,
                                                    fontSize: { xs: '1.08rem', sm: '1.2rem' },
                                                    color: s.vellum,
                                                    lineHeight: 1.3,
                                                }}
                                            >
                                                {e.title}
                                            </Typography>
                                            {e.body.map((p, i) => (
                                                <Typography
                                                    key={i}
                                                    sx={{ mt: i === 0 ? 0.75 : 1, color: s.parchment, lineHeight: 1.65 }}
                                                >
                                                    {p}
                                                </Typography>
                                            ))}
                                        </Box>
                                    </Stack>
                                ))}
                            </Stack>
                        </Box>

                        <Divider sx={{ my: 4.5, borderColor: s.edgeSoft }} />

                        {/* smaller changes */}
                        <Typography sx={sectionHeadingSx}>Also improved</Typography>
                        <Stack spacing={1.25}>
                            {r.improved.map(([lead, rest]) => (
                                <Stack key={lead} direction="row" spacing={1.5} alignItems="flex-start">
                                    <Box aria-hidden sx={{ color: s.gold, fontSize: 12, lineHeight: 1.9 }}>✦</Box>
                                    <Typography sx={{ color: s.parchment, lineHeight: 1.65 }}>
                                        <Box component="span" sx={{ color: s.vellum, fontWeight: 700 }}>{lead}</Box>{' '}
                                        {rest}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>

                        {r.next && (
                            <Typography sx={{ mt: 4, pt: 2.5, borderTop: `1px solid ${s.edgeSoft}`, color: s.parchment, fontSize: 14, fontStyle: 'italic' }}>
                                {r.next}
                            </Typography>
                        )}
                    </Box>
                ))}
            </Paper>
        </Box>
    );
}
