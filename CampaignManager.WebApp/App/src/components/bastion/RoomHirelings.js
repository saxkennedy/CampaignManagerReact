import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, IconButton, TextField, Chip, Tooltip,
    CircularProgress, Divider, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import HirelingService from '../../api/HirelingService';

let tmpSeq = 0;
const tmpId = () => `pend_${Date.now()}_${tmpSeq++}`;

// Hirelings for one facility room, drawn from the campaign-scoped pool.
// - Saved room (roomId set): API-backed; editing needs DM (API `canManage`).
// - Unsaved room (no roomId): STAGED — queued in `pending` via `onPendingChange`, and
//   flushed to the server by the builder on save. `canManage` gates staging (DM only).
export default function RoomHirelings({ roomId, campaignId, capacity, pending = [], onPendingChange, canManage: canManageProp }) {
    const staged = !roomId;

    const [loading, setLoading] = useState(!staged);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [apiCanManage, setApiCanManage] = useState(false);
    const [hirelings, setHirelings] = useState([]);
    const [pool, setPool] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [newName, setNewName] = useState('');
    const [assignId, setAssignId] = useState('');

    const canManage = staged ? !!canManageProp : apiCanManage;

    const load = useCallback(async () => {
        try {
            setError('');
            let manage = canManageProp;
            if (!staged) {
                setLoading(true);
                const resp = await HirelingService.listRoomHirelings(roomId);
                setHirelings(resp?.hirelings || []);
                setApiCanManage(!!resp?.canManage);
                manage = !!resp?.canManage;
                setDrafts({});
            }
            if (manage && campaignId) {
                const camp = await HirelingService.listCampaignHirelings(campaignId).catch(() => null);
                setPool((camp?.hirelings || []).filter((h) => !h.bastionRoomId));
            } else {
                setPool([]);
            }
        } catch (e) {
            setError(e?.message || 'Failed to load hirelings.');
        } finally {
            setLoading(false);
        }
    }, [roomId, campaignId, staged, canManageProp]);

    useEffect(() => { load(); }, [load]);

    const run = async (fn) => {
        setBusy(true); setError('');
        try { await fn(); await load(); }
        catch (e) { setError(e?.message || 'Something went wrong.'); }
        finally { setBusy(false); }
    };

    // --- staged (unsaved room) actions ---
    const stagedPoolIds = new Set(pending.filter((p) => p.kind === 'pool').map((p) => String(p.id)));
    const stagedAdd = () => {
        const name = newName.trim();
        if (!name) return;
        onPendingChange([...pending, { kind: 'new', tempId: tmpId(), name }]);
        setNewName('');
    };
    const stagedAssign = () => {
        if (!assignId) return;
        const h = pool.find((x) => String(x.id) === String(assignId));
        if (h) onPendingChange([...pending, { kind: 'pool', id: h.id, name: h.name }]);
        setAssignId('');
    };
    const stagedRemove = (item) => onPendingChange(pending.filter((p) => (p.tempId || p.id) !== (item.tempId || item.id)));

    // --- saved (API) actions ---
    const add = () => {
        const name = newName.trim();
        if (!name) return;
        run(async () => { await HirelingService.createHireling(campaignId, { name, bastionRoomId: roomId }); setNewName(''); });
    };
    const assignFromPool = () => {
        if (!assignId) return;
        run(async () => { await HirelingService.updateHireling(assignId, { bastionRoomId: roomId }); setAssignId(''); });
    };
    const saveField = (h, field) => {
        const val = (drafts[h.id]?.[field] ?? h[field] ?? '').trim();
        if (val === (h[field] || '')) return;
        run(() => HirelingService.updateHireling(h.id, { [field]: val }));
    };
    const toggleAway = (h) => run(() => HirelingService.updateHireling(h.id, { isAbsent: !h.isAbsent }));
    const unassign = (h) => run(() => HirelingService.updateHireling(h.id, { unassign: true }));
    const remove = (h) => run(() => HirelingService.deleteHireling(h.id));

    const draftVal = (h, field) => drafts[h.id]?.[field] ?? h[field] ?? '';
    const setDraft = (id, field, value) => setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));

    const availablePool = staged ? pool.filter((h) => !stagedPoolIds.has(String(h.id))) : pool;
    const count = staged ? pending.length : hirelings.length;
    const max = capacity?.max ?? 0;
    const unbounded = !!capacity?.unbounded;
    const over = !unbounded && max > 0 && count > max;

    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Hirelings</Typography>
                <Chip size="small" color={over ? 'warning' : 'default'} label={`${count} / ${max}${unbounded ? '+' : ''}`} />
                {staged && <Chip size="small" color="info" label="queued" />}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
            {over && <Alert severity="warning" sx={{ mb: 1, py: 0 }}>Over this facility's hireling capacity.</Alert>}
            {staged && canManage && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Queued — these are added to the room when you save the bastion.
                </Typography>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}><CircularProgress size={20} /></Box>
            ) : staged ? (
                pending.length === 0
                    ? <Typography variant="caption" color="text.secondary">None queued yet.</Typography>
                    : (
                        <Stack spacing={0.5} divider={<Divider flexItem />}>
                            {pending.map((p) => (
                                <Box key={p.tempId || p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" sx={{ flex: 1 }}>{p.name}</Typography>
                                    {p.kind === 'pool' && <Chip size="small" label="from pool" />}
                                    {canManage && (
                                        <Tooltip title="Remove from queue">
                                            <span><IconButton size="small" color="error" onClick={() => stagedRemove(p)}>🗑</IconButton></span>
                                        </Tooltip>
                                    )}
                                </Box>
                            ))}
                        </Stack>
                    )
            ) : hirelings.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No hirelings assigned here.</Typography>
            ) : (
                <Stack spacing={1} divider={<Divider flexItem />}>
                    {hirelings.map((h) => (
                        <Box key={h.id} sx={{ opacity: h.isAbsent ? 0.6 : 1 }}>
                            {canManage ? (
                                <Stack spacing={0.5}>
                                    <TextField size="small" fullWidth value={draftVal(h, 'name')}
                                        onChange={(e) => setDraft(h.id, 'name', e.target.value)}
                                        onBlur={() => saveField(h, 'name')}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveField(h, 'name'); } }}
                                        disabled={busy} />
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <TextField size="small" fullWidth placeholder="role" value={draftVal(h, 'role')}
                                            onChange={(e) => setDraft(h.id, 'role', e.target.value)}
                                            onBlur={() => saveField(h, 'role')}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveField(h, 'role'); } }}
                                            disabled={busy} />
                                        <Tooltip title={h.isAbsent ? 'Away — click to mark present' : 'Present — click to mark away'}>
                                            <span><IconButton size="small" onClick={() => toggleAway(h)} disabled={busy}>{h.isAbsent ? '🚪' : '🏠'}</IconButton></span>
                                        </Tooltip>
                                        <Tooltip title="Return to campaign pool">
                                            <span><IconButton size="small" onClick={() => unassign(h)} disabled={busy}>↩︎</IconButton></span>
                                        </Tooltip>
                                        <Tooltip title="Delete hireling">
                                            <span><IconButton size="small" color="error" onClick={() => remove(h)} disabled={busy}>🗑</IconButton></span>
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                            ) : (
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {h.name}{h.isAbsent && <Chip size="small" label="away" sx={{ ml: 1 }} />}
                                    </Typography>
                                    {h.role && <Typography variant="caption" color="text.secondary">{h.role}</Typography>}
                                </Box>
                            )}
                        </Box>
                    ))}
                </Stack>
            )}

            {canManage && (
                <Stack spacing={1} sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={0.5}>
                        <TextField size="small" fullWidth placeholder="New hireling…" value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); staged ? stagedAdd() : add(); } }}
                            disabled={busy} />
                        <Button variant="outlined" size="small" onClick={staged ? stagedAdd : add} disabled={busy || !newName.trim()}>Add</Button>
                    </Stack>
                    {availablePool.length > 0 && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <FormControl size="small" fullWidth>
                                <InputLabel>Assign from pool</InputLabel>
                                <Select label="Assign from pool" value={assignId} onChange={(e) => setAssignId(e.target.value)}>
                                    {availablePool.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}{h.role ? ` (${h.role})` : ''}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <Button variant="outlined" size="small" onClick={staged ? stagedAssign : assignFromPool} disabled={busy || !assignId}>Assign</Button>
                        </Stack>
                    )}
                </Stack>
            )}
        </Box>
    );
}
