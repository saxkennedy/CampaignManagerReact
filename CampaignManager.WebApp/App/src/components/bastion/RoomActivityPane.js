import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, IconButton, Chip, Divider, Paper,
    TextField, MenuItem, FormControl, InputLabel, Select, ToggleButton, ToggleButtonGroup,
    OutlinedInput, Checkbox, ListItemText, CircularProgress,
} from '@mui/material';
import BastionTurnService from '../../api/BastionTurnService';
import ActivityService from '../../api/ActivityService';
import HirelingService from '../../api/HirelingService';
import ConfirmDialog from '../utilities/ConfirmDialog';

function orderForFacility(fac) {
    if (!fac?.ordersJson) return null;
    try { const a = JSON.parse(fac.ordersJson); return Array.isArray(a) && a.length ? a[0] : null; }
    catch { return null; }
}

const emptyForm = { id: null, characterId: '', actionKind: 'order', title: '', turnsCost: 1, longRestsCost: 0, startDay: '', durationDays: 1, hirelingIds: [] };

// The player-facing "use this room" panel: facility description, everyone's planned
// actions in the room (with when it's in use), and — for the player's own assigned
// characters — a way to add/edit/remove actions and allocate stationed hirelings.
export default function RoomActivityPane({ roomId, roomName, bastionId, facility, maxConcurrent = 1, onChanged, detailsOpen, onToggleDetails }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [segment, setSegment] = useState(null);   // the single open segment (or null)
    const [activities, setActivities] = useState([]); // all activities in the open segment
    const [myUserId, setMyUserId] = useState(null);
    const [canManage, setCanManage] = useState(false);
    const [roomHirelings, setRoomHirelings] = useState([]);
    const [form, setForm] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const order = orderForFacility(facility);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError('');
            const segResp = await BastionTurnService.listSegments(bastionId);
            const open = (segResp?.segments || []).find((s) => s.status === 'Open') || null;
            setSegment(open);
            setMyUserId(segResp?.myUserId ? String(segResp.myUserId) : null);
            setCanManage(!!segResp?.canManage);
            const hs = await HirelingService.listRoomHirelings(roomId).catch(() => null);
            setRoomHirelings(hs?.hirelings || []);
            if (open) {
                const acts = await ActivityService.listActivities(open.id);
                setActivities(acts?.activities || []);
            } else {
                setActivities([]);
            }
        } catch (e) {
            setError(e?.message || 'Failed to load.');
        } finally { setLoading(false); }
    }, [bastionId, roomId]);

    useEffect(() => { setForm(null); load(); }, [load]);

    const roomActivities = useMemo(
        () => activities.filter((a) => String(a.bastionRoomId) === String(roomId)),
        [activities, roomId]
    );
    const myChars = useMemo(() => {
        const list = segment?.characters || [];
        return canManage ? list : list.filter((c) => myUserId && String(c.ownerUserId) === myUserId);
    }, [segment, canManage, myUserId]);

    const remainingFor = (charId) => {
        if (!segment) return { turns: 0, rests: 0 };
        const restBudget = segment.daysGranted * segment.longRestsPerDay;
        let t = 0, r = 0;
        for (const a of activities) {
            if (a.status === 'Cancelled' || a.characterId !== charId) continue;
            t += a.turnsCost; r += a.longRestsCost;
        }
        return { turns: segment.turnsGranted - t, rests: restBudget - r };
    };

    // When is this room's order slot occupied?
    const busyRanges = useMemo(() => roomActivities
        .filter((a) => a.actionKind === 'order' && a.status !== 'Cancelled' && a.startDay != null)
        .map((a) => ({ start: a.startDay, end: a.startDay + Math.max(1, a.durationDays) - 1, who: a.characterName, order: a.orderType }))
        .sort((x, y) => x.start - y.start), [roomActivities]);

    const run = async (fn) => {
        setBusy(true); setError('');
        try { await fn(); await load(); if (onChanged) onChanged(); }
        catch (e) { setError(e?.message || 'Action failed.'); }
        finally { setBusy(false); }
    };

    const openNew = () => setForm({ ...emptyForm, actionKind: order ? 'order' : 'special', turnsCost: order ? 1 : 0, longRestsCost: order ? 0 : 1, characterId: myChars[0]?.characterId || '' });
    const openEdit = (a) => setForm({
        id: a.id, characterId: a.characterId, actionKind: a.actionKind, title: a.title || '',
        turnsCost: a.turnsCost, longRestsCost: a.longRestsCost, startDay: a.startDay ?? '', durationDays: a.durationDays,
        hirelingIds: (a.hirelings || []).map((h) => h.id),
    });
    const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

    const submit = () => {
        if (!form.characterId) { setError('Pick a character.'); return; }
        const payload = {
            characterId: form.characterId,
            bastionRoomId: roomId,
            actionKind: form.actionKind,
            orderType: form.actionKind === 'order' ? (order || null) : null,
            title: form.title.trim() || null,
            turnsCost: Math.max(0, Number(form.turnsCost) || 0),
            longRestsCost: Math.max(0, Number(form.longRestsCost) || 0),
            startDay: form.startDay === '' ? null : Math.max(1, Number(form.startDay) || 1),
            durationDays: Math.max(0, Number(form.durationDays) || 0),
            hirelingIds: form.hirelingIds,
        };
        run(async () => {
            if (form.id) await ActivityService.updateActivity(form.id, payload);
            else await ActivityService.createActivity(segment.id, payload);
            setForm(null);
        });
    };

    const removeActivity = (a) => setConfirm({
        title: 'Remove action?', message: `Remove ${a.characterName}'s ${a.orderType || a.actionKind}${a.title ? ` “${a.title}”` : ''}?`,
        action: () => ActivityService.deleteActivity(a.id),
    });

    const canEdit = (a) => canManage || (myUserId && String(a.ownerUserId) === myUserId);
    const scheduleText = (a) => a.startDay == null ? 'unscheduled' : `day ${a.startDay}${a.durationDays > 1 ? `–${a.startDay + a.durationDays - 1}` : ''}`;

    return (
        <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{roomName || facility?.name || 'Room'}</Typography>
            {facility?.name && roomName !== facility.name && <Typography variant="caption" color="text.secondary">{facility.name}</Typography>}

            {error && <Alert severity="error" sx={{ my: 1 }} onClose={() => setError('')}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
            ) : (
                <>
                    {onToggleDetails && facility && (
                        <Button size="small" onClick={onToggleDetails} sx={{ mt: 0.5 }}>
                            {detailsOpen ? '📖 Hide details' : '📖 Facility details'}
                        </Button>
                    )}

                    {roomHirelings.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            🧍 Hirelings here: {roomHirelings.map((h) => h.name + (h.isAbsent ? ' (away)' : '')).join(', ')}
                        </Typography>
                    )}

                    <Divider sx={{ my: 1 }} />

                    {!segment ? (
                        <Typography variant="body2" color="text.secondary">No active downtime here right now.</Typography>
                    ) : (
                        <>
                            {order && (
                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Order slot: <strong>{order}</strong> · {maxConcurrent} at a time
                                    </Typography>
                                    {busyRanges.length > 0 && (
                                        <Stack sx={{ mt: 0.5 }} spacing={0.25}>
                                            {busyRanges.map((b, i) => (
                                                <Typography key={i} variant="caption">
                                                    🛠 In use <strong>day {b.start}{b.end > b.start ? `–${b.end}` : ''}</strong> — {b.who}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    )}
                                </Box>
                            )}

                            {/* planned actions in this room (everyone) */}
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>Planned here</Typography>
                            {roomActivities.length === 0 && <Typography variant="caption" color="text.secondary">Nothing planned yet.</Typography>}
                            <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                                {roomActivities.map((a) => {
                                    const mine = myUserId && String(a.ownerUserId) === myUserId;
                                    return (
                                        <Paper key={a.id} variant="outlined" sx={{ p: 1, borderColor: mine ? 'primary.main' : undefined }}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Chip size="small" label={a.actionKind === 'order' ? (a.orderType || 'order') : 'special'}
                                                    color={a.actionKind === 'order' ? 'primary' : 'secondary'} variant="outlined" />
                                                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>{a.characterName}</Typography>
                                                {a.status !== 'Planned' && <Chip size="small" label={a.status} />}
                                                {segment.status === 'Open' && canEdit(a) && (
                                                    <>
                                                        <Button size="small" onClick={() => openEdit(a)} disabled={busy}>Edit</Button>
                                                        <IconButton size="small" color="error" onClick={() => removeActivity(a)} disabled={busy}>🗑</IconButton>
                                                    </>
                                                )}
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary">
                                                {a.title || (a.actionKind === 'order' ? 'Order' : 'Special')} · {a.turnsCost > 0 ? `${a.turnsCost} turn(s)` : `${a.longRestsCost} rest(s)`} · {scheduleText(a)}
                                            </Typography>
                                            {(a.hirelings || []).length > 0 && (
                                                <Box sx={{ mt: 0.25, display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
                                                    {a.hirelings.map((h) => <Chip key={h.id} size="small" label={h.name} />)}
                                                </Box>
                                            )}
                                        </Paper>
                                    );
                                })}
                            </Stack>

                            {/* add / edit */}
                            {segment.status === 'Open' && myChars.length > 0 && !form && (
                                <Button variant="contained" fullWidth sx={{ mt: 1.5 }} onClick={openNew} disabled={busy}>Use this room</Button>
                            )}
                            {form && (
                                <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{form.id ? 'Edit action' : 'Use this room'}</Typography>
                                    <Stack spacing={1.5}>
                                        <FormControl size="small" fullWidth>
                                            <InputLabel>Character</InputLabel>
                                            <Select label="Character" value={form.characterId} onChange={(e) => setF({ characterId: e.target.value })}>
                                                {myChars.map((c) => <MenuItem key={c.characterId} value={c.characterId}>{c.name}</MenuItem>)}
                                            </Select>
                                        </FormControl>
                                        {form.characterId && (() => { const r = remainingFor(form.characterId); return (
                                            <Typography variant="caption" color={r.turns < 0 || r.rests < 0 ? 'error' : 'text.secondary'}>
                                                Remaining: {r.turns} turn(s), {r.rests} long rest(s)
                                            </Typography>); })()}

                                        <ToggleButtonGroup size="small" exclusive value={form.actionKind}
                                            onChange={(_, v) => v && setF({ actionKind: v, turnsCost: v === 'order' ? 1 : 0, longRestsCost: v === 'special' ? 1 : 0 })}>
                                            <ToggleButton value="order" disabled={!order}>Order{order ? ` (${order})` : ''}</ToggleButton>
                                            <ToggleButton value="special">Special (rest)</ToggleButton>
                                        </ToggleButtonGroup>

                                        <TextField size="small" label="What are you doing?" value={form.title} onChange={(e) => setF({ title: e.target.value })} />

                                        <Stack direction="row" spacing={1}>
                                            {form.actionKind === 'order'
                                                ? <TextField size="small" type="number" label="Turns" value={form.turnsCost} onChange={(e) => setF({ turnsCost: e.target.value })} inputProps={{ min: 0 }} sx={{ width: 90 }} />
                                                : <TextField size="small" type="number" label="Rests" value={form.longRestsCost} onChange={(e) => setF({ longRestsCost: e.target.value })} inputProps={{ min: 0 }} sx={{ width: 90 }} />}
                                            <TextField size="small" type="number" label="Start day" value={form.startDay} onChange={(e) => setF({ startDay: e.target.value })} inputProps={{ min: 1, max: segment.daysGranted }} sx={{ width: 100 }} />
                                            <TextField size="small" type="number" label="Days" value={form.durationDays} onChange={(e) => setF({ durationDays: e.target.value })} inputProps={{ min: 0 }} sx={{ width: 80 }} />
                                        </Stack>

                                        {roomHirelings.length > 0 && (
                                            <FormControl size="small" fullWidth>
                                                <InputLabel>Hirelings</InputLabel>
                                                <Select multiple value={form.hirelingIds} input={<OutlinedInput label="Hirelings" />}
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
                                            <Button size="small" onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
                                            <Button size="small" variant="contained" onClick={submit} disabled={busy}>{form.id ? 'Save' : 'Add'}</Button>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            )}
                        </>
                    )}
                </>
            )}

            <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message}
                confirmLabel="Remove" confirmColor="error" busy={busy}
                onConfirm={async () => { const a = confirm.action; setBusy(true); try { await a(); await load(); if (onChanged) onChanged(); setConfirm(null); } catch (e) { setError(e?.message || 'Failed.'); } finally { setBusy(false); } }}
                onClose={() => setConfirm(null)} />
        </Box>
    );
}
