import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, IconButton, Chip, Divider, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
    FormControl, InputLabel, Select, ToggleButton, ToggleButtonGroup,
    CircularProgress, Tooltip, OutlinedInput, Checkbox, ListItemText,
} from '@mui/material';
import ActivityService from '../../api/ActivityService';
import BastionService from '../../api/BastionService';
import HirelingService from '../../api/HirelingService';
import BastionFacilityService from '../../api/BastionFacilityService';
import ConfirmDialog from '../utilities/ConfirmDialog';
import { parseAllowedSizes } from './bastionGeometry';

function orderForFacility(fac) {
    if (!fac?.ordersJson) return null;
    try { const a = JSON.parse(fac.ordersJson); return Array.isArray(a) && a.length ? a[0] : null; }
    catch { return null; }
}

const emptyForm = {
    id: null, characterId: '', roomId: '', actionKind: 'order', orderType: '', title: '',
    turnsCost: 1, longRestsCost: 0, startDay: '', durationDays: 1, hirelingIds: [],
};

export default function SegmentActivities({ open, onClose, segment, bastionId, campaignId }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [canManage, setCanManage] = useState(false);
    const [myUserId, setMyUserId] = useState(null);
    const [activities, setActivities] = useState([]);
    const [rooms, setRooms] = useState([]);          // facility rooms in the bastion
    const [facilitiesById, setFacilitiesById] = useState({});
    const [roomHirelings, setRoomHirelings] = useState([]); // hirelings for the form's selected room
    const [form, setForm] = useState(null);          // null = closed
    const [confirm, setConfirm] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError('');
            const [actResp, bastion, facs] = await Promise.all([
                ActivityService.listActivities(segment.id),
                BastionService.getBastion(bastionId),
                BastionFacilityService.listFacilities().catch(() => []),
            ]);
            setCanManage(!!actResp?.canManage);
            setMyUserId(actResp?.myUserId ? String(actResp.myUserId) : null);
            setActivities(actResp?.activities || []);
            const facMap = {};
            (Array.isArray(facs) ? facs : []).forEach((f) => { facMap[f.id] = f; });
            setFacilitiesById(facMap);
            setRooms((bastion?.rooms || []).filter((r) => r.bastionFacilityId && r.id));
        } catch (e) {
            setError(e?.message || 'Failed to load activities.');
        } finally {
            setLoading(false);
        }
    }, [segment.id, bastionId]);

    useEffect(() => { if (open) { setForm(null); load(); } }, [open, load]);

    // Characters the actor may spend for: their own in the segment, or all if DM.
    const myChars = useMemo(() => {
        const list = segment.characters || [];
        return canManage ? list : list.filter((c) => myUserId && String(c.ownerUserId) === myUserId);
    }, [segment.characters, canManage, myUserId]);

    // Per-character budget from grants minus non-cancelled spend.
    const budgets = useMemo(() => {
        const restBudget = segment.daysGranted * segment.longRestsPerDay;
        const m = new Map();
        for (const c of segment.characters || []) m.set(c.characterId, { turns: 0, rests: 0 });
        for (const a of activities) {
            if (a.status === 'Cancelled') continue;
            const cur = m.get(a.characterId) || { turns: 0, rests: 0 };
            cur.turns += a.turnsCost; cur.rests += a.longRestsCost;
            m.set(a.characterId, cur);
        }
        return { restBudget, spent: m };
    }, [activities, segment]);

    const remainingFor = (charId) => {
        const s = budgets.spent.get(charId) || { turns: 0, rests: 0 };
        return { turns: segment.turnsGranted - s.turns, rests: budgets.restBudget - s.rests };
    };

    const facForRoom = (roomId) => {
        const room = rooms.find((r) => String(r.id) === String(roomId));
        return room ? facilitiesById[room.bastionFacilityId] : null;
    };

    // Load hirelings for the room chosen in the form.
    useEffect(() => {
        if (!form?.roomId) { setRoomHirelings([]); return; }
        let active = true;
        HirelingService.listRoomHirelings(form.roomId)
            .then((r) => { if (active) setRoomHirelings(r?.hirelings || []); })
            .catch(() => { if (active) setRoomHirelings([]); });
        return () => { active = false; };
    }, [form?.roomId]);

    const openNew = () => setForm({ ...emptyForm, characterId: myChars[0]?.characterId || '' });
    const openEdit = (a) => setForm({
        id: a.id, characterId: a.characterId, roomId: a.bastionRoomId,
        actionKind: a.actionKind, orderType: a.orderType || '', title: a.title || '',
        turnsCost: a.turnsCost, longRestsCost: a.longRestsCost,
        startDay: a.startDay ?? '', durationDays: a.durationDays,
        hirelingIds: (a.hirelings || []).map((h) => h.id),
    });

    const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

    const onRoomChange = (roomId) => {
        const fac = facForRoom(roomId);
        const ord = orderForFacility(fac);
        setForm((f) => ({
            ...f, roomId, hirelingIds: [],
            orderType: f.actionKind === 'order' ? (ord || '') : f.orderType,
        }));
    };
    const onKindChange = (kind) => {
        const fac = facForRoom(form.roomId);
        const ord = orderForFacility(fac);
        setForm((f) => ({
            ...f, actionKind: kind,
            orderType: kind === 'order' ? (ord || '') : '',
            turnsCost: kind === 'order' ? (f.turnsCost || 1) : 0,
            longRestsCost: kind === 'special' ? (f.longRestsCost || 1) : 0,
        }));
    };

    const submit = async () => {
        if (!form.characterId || !form.roomId) { setError('Pick a character and a room.'); return; }
        const payload = {
            characterId: form.characterId,
            bastionRoomId: form.roomId,
            actionKind: form.actionKind,
            orderType: form.actionKind === 'order' ? (form.orderType || null) : null,
            title: form.title.trim() || null,
            turnsCost: Math.max(0, Number(form.turnsCost) || 0),
            longRestsCost: Math.max(0, Number(form.longRestsCost) || 0),
            startDay: form.startDay === '' ? null : Math.max(1, Number(form.startDay) || 1),
            durationDays: Math.max(0, Number(form.durationDays) || 0),
            hirelingIds: form.hirelingIds,
        };
        setBusy(true); setError('');
        try {
            if (form.id) await ActivityService.updateActivity(form.id, payload);
            else await ActivityService.createActivity(segment.id, payload);
            setForm(null);
            await load();
        } catch (e) {
            setError(e?.message || 'Failed to save activity.');
        } finally { setBusy(false); }
    };

    const act = async (fn) => {
        setBusy(true); setError('');
        try { await fn(); await load(); }
        catch (e) { setError(e?.message || 'Action failed.'); }
        finally { setBusy(false); }
    };
    const removeActivity = (a) => setConfirm({
        title: 'Remove activity?', message: `Remove ${a.characterName}'s ${a.orderType || a.actionKind}${a.title ? ` “${a.title}”` : ''}?`,
        confirmLabel: 'Remove', color: 'error', action: () => ActivityService.deleteActivity(a.id),
    });
    const complete = (a) => act(() => ActivityService.updateActivity(a.id, { status: 'Completed' }));

    const canEditActivity = (a) => canManage || (myUserId && String(a.ownerUserId) === myUserId);
    const isOpen = segment.status === 'Open';

    const scheduleText = (a) => {
        if (a.startDay == null) return 'unscheduled';
        const end = a.durationDays > 1 ? `–${a.startDay + a.durationDays - 1}` : '';
        return `day ${a.startDay}${end}`;
    };

    const renderForm = () => {
        const fac = facForRoom(form.roomId);
        const ord = orderForFacility(fac);
        const rem = form.characterId ? remainingFor(form.characterId) : null;
        return (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>{form.id ? 'Edit activity' : 'New activity'}</Typography>
                <Stack spacing={2}>
                    <FormControl size="small" fullWidth>
                        <InputLabel>Character</InputLabel>
                        <Select label="Character" value={form.characterId} onChange={(e) => setF({ characterId: e.target.value })}>
                            {myChars.map((c) => <MenuItem key={c.characterId} value={c.characterId}>{c.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    {rem && (
                        <Typography variant="caption" color={rem.turns < 0 || rem.rests < 0 ? 'error' : 'text.secondary'}>
                            Remaining: {rem.turns} turn{rem.turns === 1 ? '' : 's'}, {rem.rests} long rest{rem.rests === 1 ? '' : 's'}
                        </Typography>
                    )}

                    <FormControl size="small" fullWidth>
                        <InputLabel>Facility / room</InputLabel>
                        <Select label="Facility / room" value={form.roomId} onChange={(e) => onRoomChange(e.target.value)}>
                            {rooms.length === 0 && <MenuItem disabled value="">No facility rooms in this bastion</MenuItem>}
                            {rooms.map((r) => {
                                const f = facilitiesById[r.bastionFacilityId];
                                const o = orderForFacility(f);
                                return <MenuItem key={r.id} value={r.id}>{r.name || f?.name || 'Room'}{f ? ` — ${f.name}` : ''}{o ? ` · ${o}` : ''}</MenuItem>;
                            })}
                        </Select>
                    </FormControl>

                    <ToggleButtonGroup size="small" exclusive value={form.actionKind} onChange={(_, v) => v && onKindChange(v)}>
                        <ToggleButton value="order" disabled={!ord}>Order{ord ? ` (${ord}, 1 turn)` : ''}</ToggleButton>
                        <ToggleButton value="special">Special action (long rest)</ToggleButton>
                    </ToggleButtonGroup>
                    {!ord && form.roomId && <Typography variant="caption" color="text.secondary">This facility has no bastion order — use a special action.</Typography>}

                    <TextField size="small" label={form.actionKind === 'order' ? 'What are you doing? (e.g. Craft a +1 dagger)' : 'Special action (e.g. Arcane Study Charm)'}
                        value={form.title} onChange={(e) => setF({ title: e.target.value })} />

                    <Stack direction="row" spacing={2}>
                        {form.actionKind === 'order' ? (
                            <TextField size="small" type="number" label="Turns" value={form.turnsCost}
                                onChange={(e) => setF({ turnsCost: e.target.value })} inputProps={{ min: 0 }} sx={{ width: 100 }} />
                        ) : (
                            <TextField size="small" type="number" label="Long rests" value={form.longRestsCost}
                                onChange={(e) => setF({ longRestsCost: e.target.value })} inputProps={{ min: 0 }} sx={{ width: 110 }} />
                        )}
                        <TextField size="small" type="number" label="Start day" value={form.startDay}
                            onChange={(e) => setF({ startDay: e.target.value })} inputProps={{ min: 1, max: segment.daysGranted }} sx={{ width: 110 }}
                            helperText={`1–${segment.daysGranted}`} />
                        <TextField size="small" type="number" label="Duration (days)" value={form.durationDays}
                            onChange={(e) => setF({ durationDays: e.target.value })} inputProps={{ min: 0 }} sx={{ width: 130 }} />
                    </Stack>

                    {roomHirelings.length > 0 && (
                        <FormControl size="small" fullWidth>
                            <InputLabel>Hirelings assisting</InputLabel>
                            <Select multiple value={form.hirelingIds} input={<OutlinedInput label="Hirelings assisting" />}
                                onChange={(e) => setF({ hirelingIds: e.target.value })}
                                renderValue={(sel) => roomHirelings.filter((h) => sel.includes(h.id)).map((h) => h.name).join(', ')}>
                                {roomHirelings.map((h) => (
                                    <MenuItem key={h.id} value={h.id}>
                                        <Checkbox size="small" checked={form.hirelingIds.includes(h.id)} />
                                        <ListItemText primary={h.name} secondary={h.isAbsent ? 'away' : (h.role || null)} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
                        <Button variant="contained" onClick={submit} disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save' : 'Add'}</Button>
                    </Stack>
                </Stack>
            </Paper>
        );
    };

    const renderActivity = (a) => (
        <Paper key={a.id} variant="outlined" sx={{ p: 1.5, mb: 1, opacity: a.status === 'Cancelled' ? 0.6 : 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Typography sx={{ fontWeight: 700 }}>{a.characterName}</Typography>
                <Chip size="small" label={a.actionKind === 'order' ? (a.orderType || 'order') : 'special'}
                    color={a.actionKind === 'order' ? 'primary' : 'secondary'} variant="outlined" />
                {a.status !== 'Planned' && <Chip size="small" label={a.status} color={a.status === 'Completed' ? 'success' : 'default'} />}
                <Box sx={{ flex: 1 }} />
                {isOpen && canEditActivity(a) && <Button size="small" onClick={() => openEdit(a)} disabled={busy}>Edit</Button>}
                {isOpen && canManage && a.status !== 'Completed' && <Button size="small" color="success" onClick={() => complete(a)} disabled={busy}>Complete</Button>}
                {isOpen && canEditActivity(a) && <Tooltip title="Remove"><span><IconButton size="small" color="error" onClick={() => removeActivity(a)} disabled={busy}>🗑</IconButton></span></Tooltip>}
            </Stack>
            <Typography variant="body2">
                {a.title || (a.actionKind === 'order' ? 'Order' : 'Special action')} · in <strong>{a.roomName || 'room'}</strong> ·{' '}
                {a.turnsCost > 0 && `${a.turnsCost} turn${a.turnsCost === 1 ? '' : 's'}`}
                {a.longRestsCost > 0 && `${a.turnsCost > 0 ? ', ' : ''}${a.longRestsCost} long rest${a.longRestsCost === 1 ? '' : 's'}`} · {scheduleText(a)}
            </Typography>
            {(a.hirelings || []).length > 0 && (
                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">assisted by:</Typography>
                    {a.hirelings.map((h) => <Chip key={h.id} size="small" label={h.name} />)}
                </Box>
            )}
            {a.resultSummary && <Alert severity="success" icon={false} sx={{ py: 0, mt: 0.5 }}>{a.resultSummary}</Alert>}
        </Paper>
    );

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
            <DialogTitle>Activities — {segment.title || 'Segment'}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                {!isOpen && <Alert severity="info" sx={{ mb: 2 }}>This segment is concluded — activities are locked.</Alert>}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
                ) : (
                    <>
                        {myChars.length > 0 && (
                            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'action.hover' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Budget remaining</Typography>
                                <Stack spacing={0.25}>
                                    {myChars.map((c) => {
                                        const r = remainingFor(c.characterId);
                                        return (
                                            <Typography key={c.characterId} variant="body2">
                                                <strong>{c.name}</strong>: {r.turns} turn{r.turns === 1 ? '' : 's'}, {r.rests} long rest{r.rests === 1 ? '' : 's'} left
                                            </Typography>
                                        );
                                    })}
                                </Stack>
                            </Paper>
                        )}

                        {isOpen && myChars.length > 0 && !form && (
                            <Button variant="contained" sx={{ mb: 2 }} onClick={openNew} disabled={busy}>+ Spend time</Button>
                        )}
                        {form && renderForm()}

                        <Divider sx={{ mb: 1.5 }}><Typography variant="caption" color="text.secondary">
                            {canManage ? 'All activities' : 'Activities'}
                        </Typography></Divider>
                        {activities.length === 0
                            ? <Typography color="text.secondary">Nothing spent yet.</Typography>
                            : activities.map(renderActivity)}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Close</Button>
            </DialogActions>

            <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message}
                confirmLabel={confirm?.confirmLabel} confirmColor={confirm?.color} busy={busy}
                onConfirm={async () => { const a = confirm.action; setBusy(true); try { await a(); await load(); setConfirm(null); } catch (e) { setError(e?.message || 'Action failed.'); } finally { setBusy(false); } }}
                onClose={() => setConfirm(null)} />
        </Dialog>
    );
}
