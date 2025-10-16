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
    IconButton,
    Tooltip,
    Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CampaignContentService from '../../api/CampaignContentService';
import CampaignAdminService from '../../api/CampaignAdminService';

const DEFAULT_ACCESS_LEVELS = [
    { value: 1, label: 'DM Only' },
    { value: 10, label: 'Public' },
];

const pick = (obj, pascal, camel) => obj?.[pascal] ?? obj?.[camel];

const buildAccessLevels = (personas = [], contents = []) => {
    const map = new Map();
    for (const p of personas) {
        const valueRaw = p?.Hierarchy ?? p?.hierarchy;
        if (valueRaw == null) continue;
        const value = Number(valueRaw);
        const display =
            p?.DisplayName ??
            p?.displayName ??
            p?.CampaignPersonaName ??
            p?.campaignPersonaName ??
            '';
        if (!display) continue;
        const label = `${value} - ${display}`;
        if (!map.has(value)) map.set(value, label);
    }

    let levels = Array.from(map, ([value, label]) => ({ value, label }));

    if (levels.length === 0) {
        const set = new Set(
            (contents || [])
                .map((c) => c?.AccessHierarchyLevel ?? c?.accessHierarchyLevel)
                .filter((v) => v != null)
        );
        levels = Array.from(set)
            .sort((a, b) => Number(a) - Number(b))
            .map((v) => ({ value: Number(v), label: `${v} - Level ${v}` }));
    }

    if (levels.length === 0) {
        levels = DEFAULT_ACCESS_LEVELS.map((x) => ({
            value: Number(x.value),
            label: x.label,
        }));
    }

    levels.sort((a, b) => Number(a.value) - Number(b.value));
    return levels;
};

// Build a tree from flat contents for hierarchical rendering
const buildContentTree = (items) => {
    const byId = new Map();
    const roots = [];
    for (const it of items) {
        const id = pick(it, 'Id', 'id');
        if (!id) continue;
        byId.set(id, { id, item: it, children: [] });
    }
    for (const it of items) {
        const id = pick(it, 'Id', 'id');
        const parentId = pick(it, 'ParentContentId', 'parentContentId');
        const node = byId.get(id);
        if (!node) continue;
        if (parentId && byId.has(parentId)) {
            byId.get(parentId).children.push(node);
        } else {
            roots.push(node);
        }
    }
    const sortRecursive = (nodes) => {
        nodes.sort((a, b) => {
            const an = pick(a.item, 'DisplayName', 'displayName') || '';
            const bn = pick(b.item, 'DisplayName', 'displayName') || '';
            return an.localeCompare(bn);
        });
        nodes.forEach((n) => sortRecursive(n.children));
    };
    sortRecursive(roots);
    return roots;
};

// Collect ids of nodes that have children (useful for expand-all)
const collectBranchIds = (nodes, out = new Set()) => {
    for (const n of nodes) {
        if (n.children?.length) out.add(n.id);
        collectBranchIds(n.children || [], out);
    }
    return out;
};

// Recursive tree renderer with collapse/expand
const ContentTree = ({
    nodes,
    level = 0,
    onEdit,
    onDelete,
    contentTypeNameById,
    expandedIds,
    toggleExpanded,
}) => {
    return (
        <Stack spacing={0.5}>
            {nodes.map(({ id, item, children }) => {
                const hasChildren = children && children.length > 0;
                const isExpanded = expandedIds.has(id);
                const name = pick(item, 'DisplayName', 'displayName');
                const lvl = pick(item, 'AccessHierarchyLevel', 'accessHierarchyLevel');
                const contentType = pick(item, 'ContentType', 'contentType') ?? {};
                const ctName = contentType.Type ?? "";

                return (
                    <Box key={id} sx={{ pl: level * 2 }}>
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                p: 1,
                                backgroundColor: level === 0 ? 'transparent' : 'action.hover',
                            }}
                        >
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
                                {/* Expand / collapse control (only when has children) */}
                                {hasChildren ? (
                                    <IconButton
                                        size="small"
                                        onClick={() => toggleExpanded(id)}
                                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    >
                                        {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                                    </IconButton>
                                ) : (
                                    // spacer to align text with siblings that have a chevron
                                    <Box sx={{ width: 40 }} />
                                )}

                                <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {name}
                                </Typography>
                                <Chip size="small" label={`Level ${lvl ?? '—'}`} />
                                <Chip size="small" variant="outlined" label={ctName} />
                            </Stack>
                            <Stack direction="row" spacing={1}>
                                <Tooltip title="Edit">
                                    <IconButton onClick={() => onEdit(item)} size="small">
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                    <IconButton color="error" onClick={() => onDelete(item)} size="small">
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>

                        {/* Children */}
                        {hasChildren && isExpanded && (
                            <Box
                                sx={{
                                    ml: 1.5,
                                    pl: 1.5,
                                    my: 0.5,
                                    borderLeft: '1px dashed',
                                    borderColor: 'divider',
                                }}
                            >
                                <ContentTree
                                    nodes={children}
                                    level={level + 1}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    contentTypeNameById={contentTypeNameById}
                                    expandedIds={expandedIds}
                                    toggleExpanded={toggleExpanded}
                                />
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Stack>
    );
};

/**
 * Props:
 *  - campaignId: string (required)
 */
const CampaignAdmin = ({ campaignId }) => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // Data normalized to { contents: [...], accessLevels: [...], contentTypes: [...] }
    const [data, setData] = useState({
        contents: [],
        accessLevels: DEFAULT_ACCESS_LEVELS,
        contentTypes: [], // array of { Id, Type }
    });

    // Form/UI state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null); // null = add mode; guid = edit mode
    const isEdit = Boolean(editingId);

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
    const [contentTypeId, setContentTypeId] = useState(''); // value is the ContentTypes.Id

    // Build content type lookup (Id -> Type)
    const contentTypeNameById = useMemo(() => {
        const map = new Map();
        for (const ct of data.contentTypes || []) {
            const id = pick(ct, 'Id', 'id');
            const name = pick(ct, 'Type', 'type');
            map.set(id, name);
        }
        return map;
    }, [data.contentTypes]);

    // Parent dropdown
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
                (a?.DisplayName || a?.displayName || '').localeCompare(
                    b?.DisplayName || b?.displayName || ''
                )
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
        setEditingId(null);
        setDisplayName('');
        setDescription('');
        setAccessLevel(data?.accessLevels?.[0]?.value ?? DEFAULT_ACCESS_LEVELS[0].value);
        setParentId('root');
        setContentLink('');
        setIconLink('');
        setSimpleContent('');
        setContentTypeId('');
        setSaveError('');
        setSaveOk('');
    }, [data]);

    const refreshStructure = useCallback(async () => {
        try {
            setLoading(true);
            setLoadError('');
            const resp = await CampaignContentService.getStructure(campaignId);

            const contents = pick(resp, 'CampaignContent', 'campaignContent') || [];
            const personas = pick(resp, 'CampaignPersonas', 'campaignPersonas') || [];
            const rawContentTypes = pick(resp, 'ContentTypes', 'contentTypes') || [];
            const accessLevels = buildAccessLevels(personas, contents);

            const contentTypes = rawContentTypes.map((ct) => ({
                Id: pick(ct, 'Id', 'id'),
                Type: pick(ct, 'Type', 'type'),
            }));

            setData({ contents, accessLevels, contentTypes });
            setAccessLevel(accessLevels[0]?.value ?? DEFAULT_ACCESS_LEVELS[0].value);
        } catch (e) {
            setLoadError(e?.message || 'Unable to load campaign data. Using defaults.');
            setData({ contents: [], accessLevels: DEFAULT_ACCESS_LEVELS, contentTypes: [] });
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

    const onEditClick = (item) => {
        const id = pick(item, 'Id', 'id');
        setEditingId(id);
        setDisplayName(pick(item, 'DisplayName', 'displayName') || '');
        setDescription(pick(item, 'Description', 'description') || '');
        setAccessLevel(
            Number(
                pick(item, 'AccessHierarchyLevel', 'accessHierarchyLevel') ??
                data?.accessLevels?.[0]?.value ??
                DEFAULT_ACCESS_LEVELS[0].value
            )
        );
        setParentId(pick(item, 'ParentContentId', 'parentContentId') || 'root');
        setContentLink(pick(item, 'ContentLink', 'contentLink') || '');
        setIconLink(pick(item, 'IconLink', 'iconLink') || '');
        setSimpleContent(pick(item, 'SimpleContent', 'simpleContent') || '');
        const ctId = pick(item.ContentType, 'Id', 'id')
        setContentTypeId(ctId ?? '');
        setShowForm(true);
        setSaveError('');
        setSaveOk('');
    };

    const onDeleteClick = async (item) => {
        const id = pick(item, 'Id', 'id');
        if (!id) return;
        const name = pick(item, 'DisplayName', 'displayName') || 'this item';
        const confirm = window.confirm(`Delete "${name}" and its children?`);
        if (!confirm) return;

        try {
            setSaving(true);
            const res = await CampaignAdminService.crudContent(campaignId, {
                Id: id,
                Delete: true,
            });
            const isSuccess =
                (typeof res === 'string' && res.toLowerCase().startsWith('success')) ||
                (typeof res === 'object' && res?.Success === true);

            if (!isSuccess) throw new Error(typeof res === 'string' ? res : res?.error || 'Delete failed.');

            setSaveOk('Item deleted.');
            await refreshStructure();
            if (editingId === id) resetForm();
        } catch (err) {
            setSaveError(err?.message || 'Delete failed.');
        } finally {
            setSaving(false);
        }
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
        if (data.contentTypes.length > 0 && (contentTypeId === '' || contentTypeId == null)) {
            setSaveError('Please select a Content Type.');
            return;
        }

        const base = {
            CampaignId: campaignId,
            ParentContentId: parentId === 'root' ? null : parentId,
            DisplayName: displayName.trim(),
            Description: description.trim() || null,
            AccessHierarchyLevel: Number(accessLevel),
            ContentLink: contentLink.trim() || null,
            IconLink: iconLink.trim() || null,
            SimpleContent: simpleContent.trim() || null,
            ContentTypeId: contentTypeId === '' ? null : contentTypeId,
        };

        const payload = isEdit ? { ...base, Id: editingId } : base;

        try {
            setSaving(true);
            const res = await CampaignAdminService.crudContent(campaignId, payload);
            const isSuccess =
                (typeof res === 'string' && res.toLowerCase().startsWith('success')) ||
                (typeof res === 'object' && res?.Success === true);

            if (!isSuccess) {
                throw new Error(typeof res === 'string' ? res : res?.error || 'Save failed.');
            }

            setSaveOk(isEdit ? 'Content updated successfully.' : 'Content added successfully.');
            await refreshStructure();

            if (isEdit) {
                resetForm();
                setShowForm(false);
            } else {
                // fast add loop
                setDisplayName('');
                setDescription('');
                setContentLink('');
                setIconLink('');
                setSimpleContent('');
                setParentId('root');
                setContentTypeId('');
            }
        } catch (err) {
            setSaveError(err?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    // Tree data for the “Existing Content” section
    const contentTree = useMemo(
        () => buildContentTree(data.contents || []),
        [data.contents]
    );

    // Collapse/expand state
    const [expandedIds, setExpandedIds] = useState(new Set());

    // When content changes, expand all nodes that have children by default.
    useEffect(() => {
        const all = collectBranchIds(contentTree);
        setExpandedIds(new Set(contentTree.map(n => n.id)));
 // If you prefer only roots expanded: setExpandedIds(new Set(contentTree.map(n => n.id)));
    }, [contentTree]);

    const toggleExpanded = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setExpandedIds(collectBranchIds(contentTree));
    }, [contentTree]);

    const collapseAll = useCallback(() => {
        setExpandedIds(new Set());
    }, []);

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
                        <Stack spacing={3}>
                            {/* Actions */}
                            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                                <Button variant="contained" color="warning" onClick={onAddClick}>
                                    Add Content
                                </Button>
                                <Typography variant="body2" color="text.secondary">
                                    Create a new content node and place it in the hierarchy.
                                </Typography>

                                <Box sx={{ flexGrow: 1 }} />

                                {/* Expand/Collapse controls */}
                                <Stack direction="row" spacing={1}>
                                    <Button size="small" variant="outlined" onClick={expandAll}>
                                        Expand all
                                    </Button>
                                    <Button size="small" variant="outlined" onClick={collapseAll}>
                                        Collapse all
                                    </Button>
                                </Stack>
                            </Stack>

                            {/* Existing content hierarchy */}
                            <Box>
                                <Typography variant="h6" sx={{ mb: 1 }}>
                                    Existing Content
                                </Typography>
                                {contentTree.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        No content items yet.
                                    </Typography>
                                ) : (
                                    <ContentTree
                                        nodes={contentTree}
                                        onEdit={onEditClick}
                                        onDelete={onDeleteClick}
                                        contentTypeNameById={contentTypeNameById}
                                        expandedIds={expandedIds}
                                        toggleExpanded={toggleExpanded}
                                    />
                                )}
                            </Box>

                            {/* Form */}
                            {showForm && (
                                <Box component="form" onSubmit={onSubmit}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {isEdit ? 'Edit Content' : 'Add Content'}
                                            </Typography>
                                        </Grid>

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
                                            <FormControl fullWidth disabled={data.contentTypes.length === 0} required>
                                                <InputLabel id="content-type-label">Content Type</InputLabel>
                                                <Select
                                                    labelId="content-type-label"
                                                    label="Content Type"
                                                    value={contentTypeId}                                                    
                                                    onChange={(e) => setContentTypeId(e.target.value)}
                                                >
                                                    {(data.contentTypes || []).map((ct) => {
                                                        const id = pick(ct, 'Id', 'id');
                                                        const name = pick(ct, 'Type', 'type');
                                                        return (
                                                            <MenuItem key={id} value={id}>
                                                                {name}
                                                            </MenuItem>
                                                        );
                                                    })}
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
                                                    {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outlined"
                                                    onClick={() => {
                                                        setShowForm(false);
                                                        resetForm();
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
