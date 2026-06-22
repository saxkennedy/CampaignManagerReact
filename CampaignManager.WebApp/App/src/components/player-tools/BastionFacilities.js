import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Typography,
    Paper,
    Alert,
    Stack,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    Link as MuiLink,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BastionFacilityService from '../../api/BastionFacilityService';

// Map markdown elements onto MUI so tables/links/headings match the app's look.
const markdownComponents = {
    a: ({ node, ...props }) => <MuiLink target="_blank" rel="noopener noreferrer" {...props} />,
    table: ({ node, ...props }) => (
        <Table size="small" sx={{ my: 2, width: 'auto' }} {...props} />
    ),
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

// The *Json columns are stored as raw JSON strings. We don't yet pin down their exact
// shape (that firms up once we let DMs build bastions), so parse defensively and fall
// back to the raw string if it isn't valid JSON.
function parseMaybeJson(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); }
    catch { return raw; }
}

// Render an arbitrary parsed-JSON value (string | number | array | object) readably.
function JsonValue({ value }) {
    if (value == null || value === '') {
        return <Typography color="text.secondary">—</Typography>;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return <Typography color="text.secondary">—</Typography>;
        // Array of primitives -> chips; array of objects -> nested list.
        const allPrimitive = value.every(v => typeof v !== 'object' || v == null);
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
                        <Typography component="span" sx={{ fontWeight: 600, mr: 1 }}>
                            {k}:
                        </Typography>
                        <Box component="span">
                            <JsonValue value={v} />
                        </Box>
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

export const BastionFacilities = () => {
    const [facilities, setFacilities] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const data = await BastionFacilityService.listFacilities();
                if (active) setFacilities(Array.isArray(data) ? data : []);
            } catch (e) {
                if (active) setError(e.message || 'Failed to load bastion facilities.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const selected = useMemo(
        () => facilities.find(f => f.id === selectedId) || null,
        [facilities, selectedId]
    );

    return (
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>Bastion Facilities</Typography>

            {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

            <FormControl fullWidth sx={{ mb: 3 }} disabled={loading || !!error}>
                <InputLabel>Facility</InputLabel>
                <Select
                    value={selectedId}
                    label="Facility"
                    onChange={e => setSelectedId(e.target.value)}
                >
                    {facilities.map(f => (
                        <MenuItem key={f.id} value={f.id}>
                            {f.name}{f.facilityType ? ` (${f.facilityType})` : ''}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {loading && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <CircularProgress size={20} />
                    <Typography color="text.secondary">Loading facilities…</Typography>
                </Stack>
            )}

            {selected && (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{selected.name}</Typography>

                    <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }} flexWrap="wrap" useFlexGap>
                        {selected.facilityType && <Chip label={selected.facilityType} color="primary" size="small" />}
                        {selected.levelRequired != null && <Chip label={`Level ${selected.levelRequired}`} size="small" />}
                        {selected.sourceBook && (
                            <Chip
                                variant="outlined"
                                size="small"
                                label={selected.page != null ? `${selected.sourceBook} p.${selected.page}` : selected.sourceBook}
                            />
                        )}
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    <Field label="Space">
                        <JsonValue value={parseMaybeJson(selected.spaceJson)} />
                    </Field>

                    <Field label="Hirelings">
                        <JsonValue value={parseMaybeJson(selected.hirelingsJson)} />
                    </Field>

                    <Field label="Orders">
                        <JsonValue value={parseMaybeJson(selected.ordersJson)} />
                    </Field>

                    <Field label="Prerequisite">
                        <JsonValue value={parseMaybeJson(selected.prerequisiteJson)} />
                    </Field>

                    {selected.descriptionMarkdown && (
                        <Field label="Description">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {selected.descriptionMarkdown}
                            </ReactMarkdown>
                        </Field>
                    )}
                </Paper>
            )}
        </Box>
    );
};

export default BastionFacilities;
