import React from 'react';
import {
    Box, Typography, Stack, Chip, Divider, List, ListItem, ListItemText,
    Link as MuiLink, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Map markdown elements onto MUI so tables/links/headings match the app's look.
const markdownComponents = {
    a: ({ node, ...props }) => <MuiLink target="_blank" rel="noopener noreferrer" {...props} />,
    table: ({ node, ...props }) => <Table size="small" sx={{ my: 2, width: 'auto' }} {...props} />,
    thead: ({ node, ...props }) => <TableHead {...props} />,
    tbody: ({ node, ...props }) => <TableBody {...props} />,
    tr: ({ node, ...props }) => <TableRow {...props} />,
    th: ({ node, ...props }) => <TableCell sx={{ fontWeight: 700 }} {...props} />,
    td: ({ node, ...props }) => <TableCell {...props} />,
    h1: ({ node, ...props }) => <Typography variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 700 }} {...props} />,
    h2: ({ node, ...props }) => <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 700 }} {...props} />,
    h3: ({ node, ...props }) => <Typography variant="subtitle1" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }} {...props} />,
    p: ({ node, ...props }) => <Typography sx={{ mb: 1 }} {...props} />,
    li: ({ node, ...props }) => <Typography component="li" sx={{ mb: 0.5 }} {...props} />,
};

// The *Json columns are stored as raw JSON strings whose exact shape isn't pinned
// down yet, so parse defensively and fall back to the raw string if it isn't JSON.
export function parseMaybeJson(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); }
    catch { return raw; }
}

// Render an arbitrary parsed-JSON value (string | number | array | object) readably.
export function JsonValue({ value }) {
    if (value == null || value === '') {
        return <Typography color="text.secondary">—</Typography>;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return <Typography color="text.secondary">—</Typography>;
        const allPrimitive = value.every((v) => typeof v !== 'object' || v == null);
        if (allPrimitive) {
            return (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {value.map((v, i) => <Chip key={i} label={String(v)} size="small" />)}
                </Stack>
            );
        }
        return (
            <List dense disablePadding>
                {value.map((v, i) => (
                    <ListItem key={i} disableGutters sx={{ alignItems: 'flex-start' }}>
                        <ListItemText primary={<JsonValue value={v} />} />
                    </ListItem>
                ))}
            </List>
        );
    }
    if (typeof value === 'object') {
        return (
            <Box>
                {Object.entries(value).map(([k, v]) => (
                    <Box key={k} sx={{ mb: 0.5 }}>
                        <Typography component="span" sx={{ fontWeight: 600, mr: 1 }}>{k}:</Typography>
                        <Box component="span"><JsonValue value={v} /></Box>
                    </Box>
                ))}
            </Box>
        );
    }
    return <Typography>{String(value)}</Typography>;
}

function Field({ label, children }) {
    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                {label}
            </Typography>
            <Box sx={{ mt: 0.5 }}>{children}</Box>
        </Box>
    );
}

// The full read-only entry for a bastion facility — shared by the player-tools
// catalog and the DM bastion builder (shown when a facility room is clicked).
export default function FacilityDetail({ facility, showName = true }) {
    if (!facility) return null;
    return (
        <Box>
            {showName && <Typography variant="h5" sx={{ fontWeight: 700 }}>{facility.name}</Typography>}

            <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }} flexWrap="wrap" useFlexGap>
                {facility.facilityType && <Chip label={facility.facilityType} color="primary" size="small" />}
                {facility.levelRequired != null && <Chip label={`Level ${facility.levelRequired}`} size="small" />}
                {facility.sourceBook && (
                    <Chip variant="outlined" size="small"
                        label={facility.page != null ? `${facility.sourceBook} p.${facility.page}` : facility.sourceBook} />
                )}
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <Field label="Space"><JsonValue value={parseMaybeJson(facility.spaceJson)} /></Field>
            <Field label="Hirelings"><JsonValue value={parseMaybeJson(facility.hirelingsJson)} /></Field>
            <Field label="Orders"><JsonValue value={parseMaybeJson(facility.ordersJson)} /></Field>
            <Field label="Prerequisite"><JsonValue value={parseMaybeJson(facility.prerequisiteJson)} /></Field>

            {facility.descriptionMarkdown && (
                <Field label="Description">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {facility.descriptionMarkdown}
                    </ReactMarkdown>
                </Field>
            )}
        </Box>
    );
}
