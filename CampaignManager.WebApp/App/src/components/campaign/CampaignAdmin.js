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
    { value: 1, label: 'Dungeon Master' },
    { value: 8, label: 'Player' },
    { value: 10, label: 'Spectator' },
];

/**
 * Props:
 *  - props.campaignId: string (required)
 */
const CampaignAdmin = (props) => {    
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
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

    // Build parent dropdown (with indentation) from flat contents
    const parentOptions = useMemo(() => {
        const items = data?.contents || [];
        const byParent = new Map();
        for (const it of items) {
            const key = it.ParentContentId || 'root';
            if (!byParent.has(key)) byParent.set(key, []);
            byParent.get(key).push(it);
        }
        for (const [k, arr] of byParent) {
            arr.sort((a, b) => (a.DisplayName || '').localeCompare(b.DisplayName || ''));
        }

        const out = [{ value: 'root', label: '— Top level —' }];
        const dfs = (parentKey, depth) => {
            const kids = byParent.get(parentKey) || [];
            for (const k of kids) {
                out.push({ value: k.Id, label: `${'— '.repeat(depth)}${k.DisplayName}` });
                dfs(k.Id, depth + 1);
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
            const resp = await CampaignAdminService.getStructure(props.campaignId);

            // If API returns boolean false or empty, use safe defaults
            const normalized =
                (resp && resp !== false)
                    ? resp
                    : { contents: [], accessLevels: DEFAULT_ACCESS_LEVELS };

            setData({
                contents: Array.isArray(normalized.contents) ? normalized.contents : [],
                accessLevels: Array.isArray(normalized.accessLevels) && normalized.accessLevels.length
                    ? normalized.accessLevels
                    : DEFAULT_ACCESS_LEVELS,
            });

            // Set default access level if needed
            const firstLevel = (normalized.accessLevels && normalized.accessLevels[0]?.value) ?? DEFAULT_ACCESS_LEVELS[0].value;
            setAccessLevel(firstLevel);
        } catch (e) {
            // On error, still allow adding by falling back to defaults
            setData({ contents: [], accessLevels: DEFAULT_ACCESS_LEVELS });
            setAccessLevel(DEFAULT_ACCESS_LEVELS[0].value);
            // Don't block the page with an error; show a soft note instead
            setLoadError(e?.message || 'Unable to load campaign data. Using defaults.');
        } finally {
            setLoading(false);
        }
    }, [props.campaignId]);

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
            CampaignId: props.campaignId,
            ParentContentId: parentId === 'root' ? null : parentId,
            DisplayName: displayName.trim(),
            Description: description.trim() || null,
            AccessHierarchyLevel: Number(accessLevel),
            CreatorId: props.userId,
            ContentLink: contentLink.trim() || null,
            IconLink: iconLink.trim() || null,
            SimpleContent: simpleContent.trim() || null,
        };

        try {
            setSaving(true);
            const res = await CampaignAdminService.addContent(props.campaignId, payload);

            // Your API returns plain text "Success" or "Failed. …"
            const isSuccess =
                (typeof res === 'string' && res.toLowerCase().startsWith('success')) ||
                (typeof res === 'object' && res?.Success === true); // tolerate a future success shape

            if (!isSuccess) {
                const msg =
                    (typeof res === 'string' ? res : res?.error) || 'Save failed.';
                throw new Error(msg);
            }

            setSaveOk('Content added successfully.');

            // 🔄 Re-fetch the latest structure from DB
            await refreshStructure();

            // Keep the form open for quick successive adds; fields cleared
            resetForm();
        } catch (err) {
            setSaveError(err?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box
            sx={{
                height: 'calc(100vh - 0px)', // parent container handles top padding
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
            }}
        >
            <Card>
                <CardHeader
                    title="Campaign Administration"
                    subheader={`Campaign ID: ${props.campaignId}`}
                />
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
                                                label="Content Link (Google Doc/Sheet/Slide) - (Optional)"
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
