import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Stack, Typography, Alert, CircularProgress, Chip, IconButton, Tooltip,
    TextField, FormControl, InputLabel, Select, MenuItem, Checkbox, FormControlLabel,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Divider, Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import CampaignAdminService from '../../api/CampaignAdminService';
import PotionLoader from '../utilities/PotionLoader';
import { CREATOR_HIERARCHY, MAX_RANK } from './campaignPermissions';

const pick = (o, P, c) => o?.[P] ?? o?.[c];
const MAX_PERSONAS = MAX_RANK + 1; // creator (0) + ranks 1..MAX_RANK

const PersonaManagement = ({ campaignId }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [personas, setPersonas] = useState([]);
    const [catalog, setCatalog] = useState([]); // [{ Id, DisplayName }]
    const [actorLevel, setActorLevel] = useState(Infinity);
    const [actorPersonaIds, setActorPersonaIds] = useState([]);

    // Form: null = closed; otherwise { id|null, name, rank, permIds:Set }
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Dialogs
    const [rankConflict, setRankConflict] = useState(null); // { hierarchy, personaName }
    const [impact, setImpact] = useState(null);             // { count, payload, isEdit }
    const [deleteBlock, setDeleteBlock] = useState(null);   // { name, members:[], count }
    const [deleting, setDeleting] = useState(false);

    const normalize = (resp) => {
        const list = (pick(resp, 'Personas', 'personas') || []).map((p) => ({
            id: pick(p, 'Id', 'id'),
            name: pick(p, 'DisplayName', 'displayName') || '',
            hierarchy: Number(pick(p, 'Hierarchy', 'hierarchy')),
            permIds: (pick(p, 'PermissionIds', 'permissionIds') || []).map(String),
            memberCount: Number(pick(p, 'MemberCount', 'memberCount') || 0),
            members: pick(p, 'Members', 'members') || [],
        }));
        const cat = (pick(resp, 'AssignablePermissions', 'assignablePermissions') || []).map((c) => ({
            Id: String(pick(c, 'Id', 'id')),
            DisplayName: pick(c, 'DisplayName', 'displayName'),
        }));
        return {
            list,
            cat,
            level: Number(pick(resp, 'ActorLevel', 'actorLevel')),
            owned: (pick(resp, 'ActorPersonaIds', 'actorPersonaIds') || []).map(String),
        };
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const resp = await CampaignAdminService.getPersonas(campaignId);
            const { list, cat, level, owned } = normalize(resp);
            setPersonas(list);
            setCatalog(cat);
            setActorLevel(Number.isFinite(level) ? level : Infinity);
            setActorPersonaIds(owned);
        } catch (e) {
            setError(e?.message || 'Failed to load personas.');
        } finally {
            setLoading(false);
        }
    }, [campaignId]);

    useEffect(() => { load(); }, [load]);

    const takenRanks = useMemo(
        () => new Set(personas.map((p) => p.hierarchy)),
        [personas]
    );

    // Ranks an actor may assign: 2..10, strictly below the actor's own level, not already taken
    // (the persona's own current rank stays available when editing).
    const availableRanks = (currentRank) => {
        const out = [];
        for (let r = 1; r <= MAX_RANK; r++) {
            if (r <= actorLevel) continue;
            if (takenRanks.has(r) && r !== currentRank) continue;
            out.push(r);
        }
        return out;
    };

    const canEdit = (p) => actorPersonaIds.includes(p.id) || p.hierarchy > actorLevel;
    const canDelete = (p) => p.hierarchy !== CREATOR_HIERARCHY && p.hierarchy > actorLevel;

    const permName = (id) => catalog.find((c) => c.Id === String(id))?.DisplayName || id;

    const openAdd = () => {
        const ranks = availableRanks(null);
        setFormError('');
        setForm({ id: null, name: '', rank: ranks[0] ?? '', permIds: new Set() });
    };

    const openEdit = (p) => {
        setFormError('');
        setForm({ id: p.id, name: p.name, rank: p.hierarchy, permIds: new Set(p.permIds) });
    };

    const togglePerm = (id) => {
        setForm((f) => {
            const next = new Set(f.permIds);
            if (next.has(id)) next.delete(id); else next.add(id);
            return { ...f, permIds: next };
        });
    };

    const submit = async (skipImpactCheck = false) => {
        if (!form) return;
        setFormError('');

        if (!form.name.trim()) { setFormError('Persona name is required.'); return; }
        if (!form.rank) { setFormError('Please choose a hierarchy/rank.'); return; }

        // Are-you-sure: editing a persona that has members assigned affects those users.
        const editingPersona = form.id ? personas.find((p) => p.id === form.id) : null;
        if (!skipImpactCheck && editingPersona && editingPersona.memberCount > 0) {
            setImpact({
                count: editingPersona.memberCount,
                isEdit: true,
                payload: buildPayload(),
            });
            return;
        }

        await doSave(buildPayload());
    };

    const buildPayload = () => ({
        Id: form.id || null,
        DisplayName: form.name.trim(),
        Hierarchy: Number(form.rank),
        PermissionIds: Array.from(form.permIds),
    });

    const doSave = async (payload) => {
        try {
            setSaving(true);
            await CampaignAdminService.upsertPersona(campaignId, payload);
            setForm(null);
            setImpact(null);
            await load();
        } catch (e) {
            if (e.rankConflict) {
                setRankConflict({
                    hierarchy: pick(e.rankConflict, 'Hierarchy', 'hierarchy'),
                    personaName: pick(e.rankConflict, 'PersonaName', 'personaName'),
                });
            } else {
                setFormError(e?.message || 'Failed to save persona.');
            }
        } finally {
            setSaving(false);
        }
    };

    const onDelete = async (p) => {
        try {
            setDeleting(true);
            const res = await CampaignAdminService.deletePersona(campaignId, p.id);
            const deleted = pick(res, 'Deleted', 'deleted');
            if (deleted) { await load(); return; }
            // Blocked: list members to move first.
            const members = pick(res, 'BlockingMembers', 'blockingMembers') || [];
            const count = Number(pick(res, 'MemberCount', 'memberCount') || members.length);
            setDeleteBlock({ name: p.name, members, count });
        } catch (e) {
            setError(e?.message || 'Failed to delete persona.');
        } finally {
            setDeleting(false);
        }
    };

    const memberLabel = (m) => {
        const fn = pick(m, 'FirstName', 'firstName');
        const ln = pick(m, 'LastName', 'lastName');
        const email = pick(m, 'Email', 'email');
        const name = [fn, ln].filter(Boolean).join(' ').trim();
        return name ? `${name} (${email})` : email;
    };

    if (loading) {
        return (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                <CircularProgress size={20} /> <Typography>Loading personas…</Typography>
            </Stack>
        );
    }

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Typography variant="h6">Personas</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                    startIcon={<AddIcon />}
                    variant="contained"
                    onClick={openAdd}
                    disabled={personas.length >= MAX_PERSONAS || availableRanks(null).length === 0}
                >
                    Add Persona
                </Button>
            </Stack>

            <Stack spacing={1}>
                {personas.map((p) => (
                    <Paper key={p.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Chip
                                label={p.hierarchy === CREATOR_HIERARCHY ? 'Creator (Rank 0)' : `Rank ${p.hierarchy}`}
                                size="small"
                                color={p.hierarchy === CREATOR_HIERARCHY ? 'warning' : 'default'}
                            />
                            <Typography sx={{ fontWeight: 600, minWidth: 140 }}>{p.name}</Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ flexGrow: 1 }}>
                                {p.permIds.length === 0
                                    ? <Typography variant="body2" color="text.secondary">No permissions</Typography>
                                    : p.permIds.map((id) => <Chip key={id} size="small" variant="outlined" label={permName(id)} />)}
                            </Stack>
                            {p.memberCount >= 10 ? (
                                <Chip label="10+ members" size="small" />
                            ) : p.memberCount === 0 ? (
                                <Chip label="No members" size="small" variant="outlined" />
                            ) : (
                                <Tooltip
                                    title={
                                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                            {p.members.map((m) => (
                                                <li key={pick(m, 'UserId', 'userId')}>{memberLabel(m)}</li>
                                            ))}
                                        </Box>
                                    }
                                >
                                    <Chip label={`${p.memberCount} member${p.memberCount === 1 ? '' : 's'}`} size="small" />
                                </Tooltip>
                            )}
                            <Tooltip title={canEdit(p) ? 'Edit' : 'You can only edit personas below your own level'}>
                                <span>
                                    <IconButton size="small" onClick={() => openEdit(p)} disabled={!canEdit(p)}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title={canDelete(p) ? 'Delete' : 'Cannot delete this persona'}>
                                <span>
                                    <IconButton size="small" color="error" onClick={() => onDelete(p)} disabled={!canDelete(p)}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Paper>
                ))}
            </Stack>

            {/* Add / edit form */}
            {form && (
                <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                        {form.id ? 'Edit Persona' : 'Add Persona'}
                    </Typography>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Persona Name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                fullWidth
                                required
                            />
                            <FormControl sx={{ minWidth: 160 }} disabled={form.rank === CREATOR_HIERARCHY}>
                                <InputLabel id="rank-label">Rank</InputLabel>
                                <Select
                                    labelId="rank-label"
                                    label="Rank"
                                    value={form.rank}
                                    onChange={(e) => setForm({ ...form, rank: e.target.value })}
                                >
                                    {form.rank === CREATOR_HIERARCHY && (
                                        <MenuItem value={CREATOR_HIERARCHY}>0 (Creator)</MenuItem>
                                    )}
                                    {availableRanks(form.id ? personas.find((p) => p.id === form.id)?.hierarchy : null)
                                        .map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Stack>

                        <Divider textAlign="left">
                            <Typography variant="body2" color="text.secondary">Permissions</Typography>
                        </Divider>
                        {form.rank === CREATOR_HIERARCHY && (
                            <Alert severity="info" sx={{ py: 0 }}>
                                The creator persona always holds every permission.
                            </Alert>
                        )}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {catalog.map((c) => {
                                const isCreator = form.rank === CREATOR_HIERARCHY;
                                return (
                                    <FormControlLabel
                                        key={c.Id}
                                        control={
                                            <Checkbox
                                                checked={isCreator ? true : form.permIds.has(c.Id)}
                                                disabled={isCreator}
                                                onChange={() => togglePerm(c.Id)}
                                            />
                                        }
                                        label={c.DisplayName}
                                        sx={{ minWidth: 220 }}
                                    />
                                );
                            })}
                        </Box>

                        {formError && <Alert severity="error">{formError}</Alert>}

                        <Stack direction="row" spacing={2}>
                            <Button variant="contained" onClick={() => submit(false)} disabled={saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                            <Button variant="outlined" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
                        </Stack>
                    </Stack>
                </Paper>
            )}

            {/* Delete in flight */}
            <Dialog open={deleting}>
                <DialogContent>
                    <PotionLoader label="Checking members…" minHeight={120} />
                </DialogContent>
            </Dialog>

            {/* Rank collision dialog */}
            <Dialog open={!!rankConflict} onClose={() => setRankConflict(null)}>
                <DialogTitle>Rank already in use</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Hierarchy {rankConflict?.hierarchy} is already held by
                        {' '}<strong>{rankConflict?.personaName}</strong>. You must edit or remove that
                        persona before assigning this rank.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRankConflict(null)}>OK</Button>
                </DialogActions>
            </Dialog>

            {/* Impact confirmation */}
            <Dialog open={!!impact} onClose={() => setImpact(null)}>
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This persona has {impact?.count} member{impact?.count === 1 ? '' : 's'} assigned.
                        Changing its name, rank, or permissions will affect what {impact?.count === 1 ? 'they' : 'they all'} can
                        access. Continue?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImpact(null)}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={() => doSave(impact.payload)} disabled={saving}>
                        Yes, apply
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete blocked by members */}
            <Dialog open={!!deleteBlock} onClose={() => setDeleteBlock(null)}>
                <DialogTitle>Reassign members first</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 1 }}>
                        <strong>{deleteBlock?.name}</strong> still has members assigned. Move these users to
                        another persona (Users tab) before deleting it:
                    </DialogContentText>
                    {deleteBlock?.count >= 10 ? (
                        <Typography>10+ members are assigned — reassign them from the Users tab.</Typography>
                    ) : (
                        <ul>
                            {(deleteBlock?.members || []).map((m) => (
                                <li key={pick(m, 'UserId', 'userId')}>{memberLabel(m)}</li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteBlock(null)}>OK</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PersonaManagement;
