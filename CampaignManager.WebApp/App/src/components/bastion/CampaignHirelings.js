import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, IconButton, Chip, Divider, Paper, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import HirelingService from '../../api/HirelingService';
import BastionService from '../../api/BastionService';
import PotionLoader from '../utilities/PotionLoader';
import { WIDE_DIALOG_PROPS } from './dialogSizing';

// The campaign's whole hireling pool: an Unassigned group plus everyone assigned to a
// room (grouped by bastion → room). A DM can add to the pool, assign hirelings to rooms
// in THIS bastion, unassign, and delete. (To place a hireling in another bastion, open
// that bastion's builder.)
export default function CampaignHirelings({ open, onClose, campaignId, bastionId, bastionName }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [canManage, setCanManage] = useState(false);
    const [hirelings, setHirelings] = useState([]);
    const [rooms, setRooms] = useState([]);       // facility rooms in THIS bastion
    const [newName, setNewName] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true); setError('');
            const resp = await HirelingService.listCampaignHirelings(campaignId);
            setCanManage(!!resp?.canManage);
            setHirelings(resp?.hirelings || []);
            if (bastionId) {
                const b = await BastionService.getBastion(bastionId).catch(() => null);
                setRooms((b?.rooms || []).filter((r) => r.bastionFacilityId && r.id));
            }
        } catch (e) {
            setError(e?.message || 'Failed to load hirelings.');
        } finally {
            setLoading(false);
        }
    }, [campaignId, bastionId]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const run = async (fn) => {
        setBusy(true); setError('');
        try { await fn(); await load(); }
        catch (e) { setError(e?.message || 'Something went wrong.'); }
        finally { setBusy(false); }
    };

    const addToPool = () => {
        const name = newName.trim();
        if (!name) return;
        run(async () => { await HirelingService.createHireling(campaignId, { name }); setNewName(''); });
    };
    const assignTo = (h, roomId) => run(() => roomId
        ? HirelingService.updateHireling(h.id, { bastionRoomId: roomId })
        : HirelingService.updateHireling(h.id, { unassign: true }));
    const remove = (h) => run(() => HirelingService.deleteHireling(h.id));

    const roomIdsThisBastion = useMemo(() => new Set(rooms.map((r) => String(r.id))), [rooms]);

    const { unassigned, groups } = useMemo(() => {
        const un = [];
        const byBastion = new Map();
        for (const h of hirelings) {
            if (!h.bastionRoomId) { un.push(h); continue; }
            const key = h.bastionName || 'Bastion';
            if (!byBastion.has(key)) byBastion.set(key, new Map());
            const rmap = byBastion.get(key);
            const rkey = h.roomName || 'Room';
            if (!rmap.has(rkey)) rmap.set(rkey, []);
            rmap.get(rkey).push(h);
        }
        return { unassigned: un, groups: byBastion };
    }, [hirelings]);

    const hirelingRow = (h) => (
        <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, opacity: h.isAbsent ? 0.6 : 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {h.name}{h.isAbsent && <Chip size="small" label="away" sx={{ ml: 1 }} />}
                </Typography>
                {h.role && <Typography variant="caption" color="text.secondary">{h.role}</Typography>}
            </Box>
            {canManage && (
                <>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Assign to</InputLabel>
                        <Select label="Assign to"
                            value={h.bastionRoomId && roomIdsThisBastion.has(String(h.bastionRoomId)) ? String(h.bastionRoomId) : ''}
                            onChange={(e) => assignTo(h, e.target.value || null)} disabled={busy}>
                            <MenuItem value=""><em>Unassigned</em></MenuItem>
                            {rooms.map((r) => <MenuItem key={r.id} value={String(r.id)}>{r.name || 'Room'} ({bastionName})</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Tooltip title="Delete hireling">
                        <span><IconButton size="small" color="error" onClick={() => remove(h)} disabled={busy}>🗑</IconButton></span>
                    </Tooltip>
                </>
            )}
        </Box>
    );

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} {...WIDE_DIALOG_PROPS}>
            <DialogTitle>Campaign Hirelings</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

                {loading && hirelings.length === 0 ? (
                    <PotionLoader label="Gathering hirelings…" minHeight={160} />
                ) : (
                    <>
                        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                Unassigned pool <Chip size="small" label={unassigned.length} sx={{ ml: 0.5 }} />
                            </Typography>
                            {unassigned.length === 0
                                ? <Typography variant="caption" color="text.secondary">No unassigned hirelings.</Typography>
                                : <Stack divider={<Divider flexItem />}>{unassigned.map(hirelingRow)}</Stack>}
                            {canManage && (
                                <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                                    <TextField size="small" fullWidth placeholder="Add hireling to pool…" value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToPool(); } }}
                                        disabled={busy} />
                                    <Button variant="contained" size="small" onClick={addToPool} disabled={busy || !newName.trim()}>Add</Button>
                                </Stack>
                            )}
                        </Paper>

                        {loading && <PotionLoader label="Refreshing…" minHeight={80} />}

                        {[...groups.entries()].map(([bastion, rmap]) => (
                            <Box key={bastion} sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{bastion}</Typography>
                                {[...rmap.entries()].map(([room, list]) => (
                                    <Box key={room} sx={{ pl: 1, mt: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{room}</Typography>
                                        <Stack divider={<Divider flexItem />}>{list.map(hirelingRow)}</Stack>
                                    </Box>
                                ))}
                            </Box>
                        ))}
                        {groups.size === 0 && !loading && (
                            <Typography variant="caption" color="text.secondary">No hirelings assigned to rooms yet.</Typography>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
