// comp/campaign/CampaignAdmin.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Grid,
    Stack,
    TextField,
    Typography,
    Alert,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    CircularProgress,
} from '@mui/material';
import CampaignAdminService from '../../api/CampaignAdminService';

const DEFAULT_ACCESS_LEVELS = [
    { value: 1, label: 'DM Only' },
    { value: 10, label: 'Public' },
];

const pick = (obj, pascal, camel) => obj?.[pascal] ?? obj?.[camel];

const buildAccessLevels = (personas = [], contents = []) => {
    // 1) Prefer personas: label = `${Hierarchy} - ${DisplayName}`
    const map = new Map(); // key by numeric hierarchy to avoid duplicates
    for (const p of personas) {
        const valueRaw = p?.Hierarchy ?? p?.hierarchy;
        if (valueRaw == null) continue;
        const value = Number(valueRaw);

        const display =
            p?.DisplayName ??
            p?.displayName ??
            p?.CampaignPersonaName ??        // fallbacks if your model uses a different name
            p?.campaignPersonaName ??
            '';

        if (!display) continue;

        const label = `${value} - ${display}`;
        if (!map.has(value)) map.set(value, label);
    }

    let levels = Array.from(map, ([value, label]) => ({ value, label }));

    // 2) If none from personas, derive from distinct content levels
    if (levels.length === 0) {
        const set = new Set(
            (contents || [])
                .map(c => c?.AccessHierarchyLevel ?? c?.accessHierarchyLevel)
                .filter(v => v != null)
        );
        levels = Array.from(set)
            .sort((a, b) => Number(a) - Number(b))
            .map(v => ({ value: Number(v), label: `${v} - Level ${v}` }));
    }
    // 3) Fallback defaults
    if (levels.length === 0) {
        levels = DEFAULT_ACCESS_LEVELS.map(x => ({ value: Number(x.value), label: x.label }));
    }
    // sort ascending by numeric value
    levels.sort((a, b) => Number(a.value) - Number(b.value));
    return levels;
};


/**
 * Props:
 *  - campaignId: string (required)
 */
const CampaignAdmin = ({ campaignId }) => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // Data normalized to { contents: [...], accessLevels: [...] }
    const [data, setData] = useState({ contents: [], accessLevels: DEFAULT_ACCESS_LEVELS });

    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveOk, setSaveOk] = useState('');

    // Form fields
    const [displayName, setDisplayName] = useState('');
    const [description, setDescription] = useState('');
    const [accessLevel, setAccessLevel] = useState(DEFAULT_ACCESS_LEVELS[0].value);
    const [parentId, setParentId] = useState('root'); // 'root' => top-level
    const [contentLink, setContentLink] = useState('');
    const [iconLink, setIconLink] = useState('');
    const [simpleContent, setSimpleContent] = useState('');

    // Parent dropdown (with indentation) from flat contents
    const parentOptions = useMemo(() => {
        const items = data?.contents || [];
        const byParent = new Map();
        for (const it of items) {
            const parentKey = it?.ParentContentId ?? it?.parentContentId ?? 'root';
            if (!byParent.has(parentKey)) byParent.set(parentKey, []);
            byParent.get(parentKey).push(it);
        }
        for (const [, arr] of byParent) {
            arr.sort((a, b) =>
                (a?.DisplayName || a?.displayName || '').localeCompare(b?.DisplayName || b?.displayName || '')
            );
        }
        const out = [{ value: 'root', label: '— Top level —' }];
        const dfs = (parentKey, depth) => {
            const kids = byParent.get(parentKey) || [];
            for (const k of kids) {
                const id = pick(k, 'Id', 'id');
                const labelText = pick(k, 'DisplayName', 'displayName');
                out.push({ value: id, label: `${'— '.repeat(depth)}${labelText}` });
                dfs(id, depth + 1);
            }
        };
        dfs('root', 1);
        return out;
    }, [data]);

    const resetForm = useCallback(() => {
        setDisplayName('');
        setDescription('');
        setAccessLevel((data?.accessLevels?.[0]?.value) ?? DEFAULT_ACCESS_LEVELS[0].value);
        setParentId('root');
        setContentLink('');
        setIconLink('');
        setSimpleContent('');
        setSaveError('');
        setSaveOk('');
    }, [data]);

    const refreshStructure = useCallback(async () => {
        try {
            setLoading(true);
            setLoadError('');
            const resp = await CampaignAdminService.getStructure(campaignId);

            // tolerate boolean false or odd casings
            const contents = pick(resp, 'CampaignContent', 'campaignContent') || [];
            const personas = pick(resp, 'CampaignPersonas', 'campaignPersonas') || [];

            const accessLevels = buildAccessLevels(personas, contents);

            setData({
                contents,
                accessLevels,
            });

            setAccessLevel(accessLevels[0]?.value ?? DEFAULT_ACCESS_LEVELS[0].value);
        } catch (e) {
            // Show a soft warning and allow adding anyway
            setLoadError(e?.message || 'Unable to load campaign data. Using defaults.');
            setData({ contents: [], accessLevels: DEFAULT_ACCESS_LEVELS });
            setAccessLevel(DEFAULT_ACCESS_LEVELS[0].value);
        } finally {
            setLoading(false);
        }
    }, [campaignId]);

    useEffect(() => {
        refreshStructure();
    }, [refreshStructure]);

    const onAddClick = () => {
        resetForm();
        setShowForm(true);
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaveError('');
        setSaveOk('');

        if (!displayName.trim()) {
            setSaveError('Display Name is required.');
            return;
        }
        if (accessLevel === '' || accessLevel === null || accessLevel === undefined) {
            setSaveError('Please select an Access Level.');
            return;
        }

        const payload = {
            CampaignId: campaignId,
            ParentContentId: parentId === 'root' ? null : parentId,
            DisplayName: displayName.trim(),
            Description: description.trim() || null,
            AccessHierarchyLevel: Number(accessLevel),
            ContentLink: contentLink.trim() || null,
            IconLink: iconLink.trim() || null,
            SimpleContent: simpleContent.trim() || null,
        };

        try {
            setSaving(true);
            const res = await CampaignAdminService.addContent(campaignId, payload);
            const isSuccess =
                (typeof res === 'string' && res.toLowerCase().startsWith('success')) ||
                (typeof res === 'object' && res?.Success === true);

            if (!isSuccess) {
                throw new Error(typeof res === 'string' ? res : (res?.error || 'Save failed.'));
            }

            setSaveOk('Content added successfully.');
            await refreshStructure(); // pull latest from DB
            resetForm(); // keep form open, clear fields for fast subsequent adds
        } catch (err) {
            setSaveError(err?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box
            sx={{
                height: 'calc(100vh - 0px)',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
            }}
        >
            <Card>
                <CardHeader title="Campaign Administration" subheader={`Campaign ID: ${campaignId}`} />
                <Divider />
                <CardContent>
                    {loading && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
                            <CircularProgress size={20} /> <Typography>Loading…</Typography>
                        </Stack>
                    )}

                    {!!loadError && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {loadError}
                        </Alert>
                    )}

                    {!loading && (
                        <Stack spacing={2}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Button variant="contained" color="warning" onClick={onAddClick}>
                                    Add Content
                                </Button>
                                <Typography variant="body2" color="text.secondary">
                                    Create a new content node and place it in the hierarchy.
                                </Typography>
                            </Stack>

                            {showForm && (
                                <Box component="form" onSubmit={onSubmit}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                label="Display Name"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                fullWidth
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth required>
                                                <InputLabel id="access-level-label">Access Level</InputLabel>
                                                <Select
                                                    labelId="access-level-label"
                                                    label="Access Level"
                                                    value={accessLevel}
                                                    onChange={(e) => setAccessLevel(e.target.value)}
                                                >
                                                    {(data?.accessLevels || DEFAULT_ACCESS_LEVELS).map((lvl) => (
                                                        <MenuItem key={lvl.value} value={lvl.value}>
                                                            {lvl.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth>
                                                <InputLabel id="parent-content-label">Parent Content</InputLabel>
                                                <Select
                                                    labelId="parent-content-label"
                                                    label="Parent Content"
                                                    value={parentId}
                                                    onChange={(e) => setParentId(e.target.value)}
                                                >
                                                    {parentOptions.map((opt) => (
                                                        <MenuItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                label="Icon Link (optional)"
                                                value={iconLink}
                                                onChange={(e) => setIconLink(e.target.value)}
                                                fullWidth
                                                placeholder="https://…"
                                            />
                                        </Grid>

                                        <Grid item xs={12}>
                                            <TextField
                                                label="Description (optional)"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                fullWidth
                                                multiline
                                                minRows={2}
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                label="Content Link (Google Doc/Sheet/Slide)"
                                                value={contentLink}
                                                onChange={(e) => setContentLink(e.target.value)}
                                                fullWidth
                                                placeholder="https://docs.google.com/…"
                                                helperText="If Simple Content is provided, it will override this link in the future."
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                label="Simple Content (optional)"
                                                value={simpleContent}
                                                onChange={(e) => setSimpleContent(e.target.value)}
                                                fullWidth
                                                multiline
                                                minRows={3}
                                                placeholder="Short text or HTML to render directly."
                                            />
                                        </Grid>

                                        <Grid item xs={12}>
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Button type="submit" variant="contained" disabled={saving}>
                                                    {saving ? 'Saving…' : 'Save'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outlined"
                                                    onClick={() => {
                                                        setShowForm(false);
                                                        setSaveError('');
                                                        setSaveOk('');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </Stack>
                                        </Grid>

                                        <Grid item xs={12}>
                                            {saveError && <Alert severity="error">{saveError}</Alert>}
                                            {saveOk && <Alert severity="success">{saveOk}</Alert>}
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}
                        </Stack>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default CampaignAdmin;
