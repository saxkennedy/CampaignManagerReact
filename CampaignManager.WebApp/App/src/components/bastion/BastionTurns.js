import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, IconButton, Chip, Divider, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
    FormControl, InputLabel, Select, FormControlLabel, Checkbox, Switch,
    Tooltip,
} from '@mui/material';
import PotionLoader from '../utilities/PotionLoader';
import { WIDE_DIALOG_PROPS } from './dialogSizing';
import BastionTurnService from '../../api/BastionTurnService';
import BastionService from '../../api/BastionService';
import ConfirmDialog from '../utilities/ConfirmDialog';
import BastionBankPanel, { computeMyBank } from './BastionBankPanel';
import SegmentActivities from './SegmentActivities';
import SegmentLog from './SegmentLog';

const ownerName = (c) => {
    const n = [c.ownerFirstName, c.ownerLastName].filter(Boolean).join(' ').trim();
    return n || c.ownerEmail || 'Unassigned';
};

const emptyForm = { editingId: null, title: '', turns: 2, days: 7, rests: 2, notes: '', includeAllActive: false, selectedIds: [] };

const BastionTurns = ({ open, onClose, bastionId, bastionName, campaignId }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [canManage, setCanManage] = useState(false);
    const [myUserId, setMyUserId] = useState(null);
    const [segments, setSegments] = useState([]);
    const [characters, setCharacters] = useState([]); // active campaign characters (DM picker)
    const [form, setForm] = useState(null); // null = form closed
    const [confirm, setConfirm] = useState(null); // { title, message, confirmLabel, color, action }
    const [activitiesFor, setActivitiesFor] = useState(null); // segment whose activities dialog is open
    const [logFor, setLogFor] = useState(null);               // segment whose DM log dialog is open

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const resp = await BastionTurnService.listSegments(bastionId);
            setCanManage(!!resp?.canManage);
            setMyUserId(resp?.myUserId ? String(resp.myUserId) : null);
            setSegments(resp?.segments || []);
            if (resp?.canManage) {
                // Segments draw from the characters ASSIGNED to this bastion.
                const cr = await BastionService.listBastionCharacters(bastionId);
                setCharacters((cr?.characters || []).map((c) => ({
                    id: c.characterId, name: c.name, ownerUserId: c.ownerUserId,
                    ownerFirstName: c.ownerFirstName, ownerLastName: c.ownerLastName,
                })));
            }
        } catch (e) {
            setError(e?.message || 'Failed to load turns.');
        } finally {
            setLoading(false);
        }
    }, [bastionId, campaignId]);

    useEffect(() => { if (open) { setForm(null); load(); } }, [open, load]);

    const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
    const toggleChar = (id) => setForm((f) => {
        const has = f.selectedIds.includes(id);
        return { ...f, selectedIds: has ? f.selectedIds.filter((x) => x !== id) : [...f.selectedIds, id] };
    });

    const openNew = () => setForm({ ...emptyForm });
    const openEdit = (s) => setForm({
        editingId: s.id,
        title: s.title || '',
        turns: s.turnsGranted,
        days: s.daysGranted,
        rests: s.longRestsPerDay,
        notes: s.notes || '',
        includeAllActive: false,
        selectedIds: (s.characters || []).map((c) => c.characterId),
    });

    const submit = async () => {
        const payload = {
            title: form.title.trim() || null,
            turnsGranted: Math.max(0, Number(form.turns) || 0),
            daysGranted: Math.max(0, Number(form.days) || 0),
            longRestsPerDay: Number(form.rests),
            notes: form.notes.trim() || null,
        };
        if (form.includeAllActive) payload.includeAllActive = true;
        else payload.characterIds = form.selectedIds;

        setBusy(true); setError('');
        try {
            if (form.editingId) await BastionTurnService.updateSegment(form.editingId, payload);
            else await BastionTurnService.createSegment(bastionId, payload);
            setForm(null);
            await load();
        } catch (e) {
            setError(e?.message || 'Failed to save.');
        } finally {
            setBusy(false);
        }
    };

    const act = async (fn) => {
        setBusy(true); setError('');
        try { await fn(); await load(); }
        catch (e) { setError(e?.message || 'Action failed.'); }
        finally { setBusy(false); }
    };

    const runConfirm = async () => {
        if (!confirm) return;
        setBusy(true); setError('');
        try {
            await confirm.action();
            await load();
            setConfirm(null);
        } catch (e) {
            setError(e?.message || 'Action failed.');
        } finally {
            setBusy(false);
        }
    };

    const conclude = (s) => setConfirm({
        title: 'Conclude segment?',
        message: `Conclude “${s.title || 'this segment'}”? Players can no longer spend against it (you can reopen it later).`,
        confirmLabel: 'Conclude', color: 'warning',
        action: () => BastionTurnService.concludeSegment(s.id),
    });
    const remove = (s) => setConfirm({
        title: 'Delete segment?',
        message: `Delete “${s.title || 'this segment'}” and all its assignments? This cannot be undone.`,
        confirmLabel: 'Delete', color: 'error',
        action: () => BastionTurnService.deleteSegment(s.id),
    });

    // Characters grouped by owner for the DM picker.
    const grouped = useMemo(() => {
        const m = new Map();
        for (const c of characters) {
            const key = ownerName(c);
            if (!m.has(key)) m.set(key, []);
            m.get(key).push(c);
        }
        return Array.from(m, ([owner, list]) => ({ owner, list }))
            .sort((a, b) => a.owner.localeCompare(b.owner));
    }, [characters]);

    const renderForm = () => (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                {form.editingId ? 'Edit segment' : 'Issue turns'}
            </Typography>
            <Stack spacing={2}>
                <TextField size="small" label="Title (optional)" value={form.title}
                    onChange={(e) => setF({ title: e.target.value })} placeholder="e.g. Downtime after the siege" />
                <Stack direction="row" spacing={2}>
                    <TextField size="small" type="number" label="Turns" value={form.turns}
                        onChange={(e) => setF({ turns: e.target.value })} inputProps={{ min: 0 }} sx={{ width: 110 }} />
                    <TextField size="small" type="number" label="Days" value={form.days}
                        onChange={(e) => setF({ days: e.target.value })} inputProps={{ min: 0 }} sx={{ width: 110 }} />
                    <FormControl size="small" sx={{ width: 160 }}>
                        <InputLabel>Long rests / day</InputLabel>
                        <Select label="Long rests / day" value={form.rests} onChange={(e) => setF({ rests: e.target.value })}>
                            <MenuItem value={0}>0</MenuItem>
                            <MenuItem value={1}>1</MenuItem>
                            <MenuItem value={2}>2</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
                <TextField size="small" label="Notes to players (optional)" value={form.notes}
                    onChange={(e) => setF({ notes: e.target.value })} multiline minRows={2} />

                <Box>
                    <FormControlLabel
                        control={<Switch checked={form.includeAllActive} onChange={(e) => setF({ includeAllActive: e.target.checked })} />}
                        label="Give to all active characters"
                    />
                    {!form.includeAllActive && (
                        <Paper variant="outlined" sx={{ maxHeight: 220, overflowY: 'auto', p: 1, mt: 0.5 }}>
                            {grouped.length === 0 && (
                                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                    No active characters in this campaign. Add characters in Campaign Administration → Users → Characters.
                                </Typography>
                            )}
                            {grouped.map((g) => (
                                <Box key={g.owner} sx={{ mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{g.owner}</Typography>
                                    {g.list.map((c) => (
                                        <Box key={c.id}>
                                            <FormControlLabel
                                                control={<Checkbox size="small" checked={form.selectedIds.includes(c.id)} onChange={() => toggleChar(c.id)} />}
                                                label={c.name}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            ))}
                        </Paper>
                    )}
                </Box>

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
                    <Button variant="contained" onClick={submit} disabled={busy}>
                        {busy ? 'Saving…' : form.editingId ? 'Save' : 'Issue'}
                    </Button>
                </Stack>
            </Stack>
        </Paper>
    );

    const renderSegment = (s) => {
        const isOpen = s.status === 'Open';
        const mine = (s.characters || []).filter((c) => myUserId && String(c.ownerUserId) === myUserId);
        return (
            <Paper key={s.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{s.title || 'Untitled segment'}</Typography>
                    <Chip size="small" label={s.status} color={isOpen ? 'success' : 'default'} />
                    <Box sx={{ flex: 1 }} />
                    <Button size="small" variant="outlined" onClick={() => setActivitiesFor(s)}>Activities</Button>
                    {canManage && <Button size="small" variant="outlined" onClick={() => setLogFor(s)}>Log</Button>}
                    {canManage && (
                        <>
                            {isOpen && <Button size="small" onClick={() => openEdit(s)} disabled={busy}>Edit</Button>}
                            {isOpen
                                ? <Button size="small" color="warning" onClick={() => conclude(s)} disabled={busy}>Conclude</Button>
                                : <Button size="small" onClick={() => act(() => BastionTurnService.reopenSegment(s.id))} disabled={busy}>Reopen</Button>}
                            <Tooltip title="Delete"><span><IconButton size="small" color="error" onClick={() => remove(s)} disabled={busy}>🗑</IconButton></span></Tooltip>
                        </>
                    )}
                </Stack>

                <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>{s.turnsGranted}</strong> turn{s.turnsGranted === 1 ? '' : 's'} ·{' '}
                    <strong>{s.daysGranted}</strong> day{s.daysGranted === 1 ? '' : 's'} ·{' '}
                    <strong>{s.longRestsPerDay}</strong> long rest{s.longRestsPerDay === 1 ? '' : 's'}/day
                    {s.daysGranted > 0 && s.longRestsPerDay > 0 && <> (<strong>{s.longRestsTotal}</strong> total)</>}
                    <Typography component="span" variant="caption" color="text.secondary"> — per character</Typography>
                </Typography>

                {s.notes && <Alert severity="info" icon={false} sx={{ py: 0.25, mb: 1 }}>{s.notes}</Alert>}

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(s.characters || []).length === 0 && (
                        <Typography variant="caption" color="text.secondary">No characters assigned.</Typography>
                    )}
                    {(s.characters || []).map((c) => {
                        const isMine = myUserId && String(c.ownerUserId) === myUserId;
                        return (
                            <Chip key={c.characterId} size="small" label={c.name}
                                color={isMine ? 'primary' : 'default'}
                                variant={isMine ? 'filled' : 'outlined'} />
                        );
                    })}
                </Box>

                {!canManage && mine.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        {isOpen
                            ? `Each of your characters here can spend ${s.turnsGranted} turn(s), ${s.daysGranted} day(s), and ${s.longRestsTotal} long rest(s). (Spending arrives soon.)`
                            : 'This segment is concluded.'}
                    </Typography>
                )}
            </Paper>
        );
    };

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} {...WIDE_DIALOG_PROPS}>
            <DialogTitle>Segments — {bastionName}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

                {loading && segments.length === 0 ? (
                    <PotionLoader label="Loading turns…" minHeight={160} />
                ) : (
                    <>
                        {computeMyBank(segments, myUserId).length > 0 && (
                            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
                                <BastionBankPanel segments={segments} myUserId={myUserId} />
                            </Paper>
                        )}

                        {canManage && !form && (
                            <Button variant="contained" onClick={openNew} sx={{ mb: 2 }} disabled={busy}>+ Issue turns</Button>
                        )}
                        {canManage && form && renderForm()}

                        {loading && <PotionLoader label="Refreshing…" minHeight={60} />}

                        {segments.length === 0 ? (
                            <Typography color="text.secondary">
                                {canManage ? 'No segments issued yet.' : 'Your DM hasn’t issued any bastion turns here yet.'}
                            </Typography>
                        ) : (
                            <>
                                <Divider sx={{ mb: 1.5 }}><Typography variant="caption" color="text.secondary">Segments</Typography></Divider>
                                {segments.map(renderSegment)}
                            </>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Close</Button>
            </DialogActions>

            <ConfirmDialog
                open={!!confirm}
                title={confirm?.title}
                message={confirm?.message}
                confirmLabel={confirm?.confirmLabel}
                confirmColor={confirm?.color}
                busy={busy}
                onConfirm={runConfirm}
                onClose={() => setConfirm(null)}
            />

            {activitiesFor && (
                <SegmentActivities
                    open={!!activitiesFor}
                    segment={activitiesFor}
                    bastionId={bastionId}
                    campaignId={campaignId}
                    onClose={() => { setActivitiesFor(null); load(); }}
                />
            )}

            {logFor && (
                <SegmentLog
                    open={!!logFor}
                    segment={logFor}
                    onClose={() => setLogFor(null)}
                />
            )}
        </Dialog>
    );
};

export default BastionTurns;
