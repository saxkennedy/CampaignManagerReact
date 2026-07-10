import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, IconButton, Chip, Divider, Paper, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select,
    MenuItem, OutlinedInput, Checkbox, ListItemText,
} from '@mui/material';
import BastionService from '../../api/BastionService';
import CampaignAdminService from '../../api/CampaignAdminService';
import CharacterService from '../../api/CharacterService';
import PotionLoader from '../utilities/PotionLoader';

const pick = (o, P, c) => o?.[P] ?? o?.[c];
const playerName = (p) => [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.email || 'Unknown';

// Owner + Manager tool for managing who can access a bastion and which of their characters
// are assigned to it. Read/Use is grantable by any Manager; Manage only by an Owner.
export default function BastionMembers({ open, onClose, bastionId, bastionName, campaignId }) {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [canGrantManage, setCanGrantManage] = useState(false);
    const [members, setMembers] = useState([]);
    const [players, setPlayers] = useState([]);      // all campaign players
    const [charsByUser, setCharsByUser] = useState({});
    const [addUser, setAddUser] = useState('');
    const [addLevel, setAddLevel] = useState('Use');

    const load = useCallback(async () => {
        try {
            setLoading(true); setError('');
            const [mem, mrs, chr] = await Promise.all([
                BastionService.listMembers(bastionId),
                CampaignAdminService.getMembers(campaignId),
                CharacterService.listCharacters(campaignId),
            ]);
            setCanGrantManage(!!mem?.canGrantManage);
            setMembers(mem?.members || []);
            setPlayers((pick(mrs, 'Members', 'members') || []).map((m) => ({
                userId: String(pick(m, 'UserId', 'userId')),
                email: pick(m, 'Email', 'email'),
                firstName: pick(m, 'FirstName', 'firstName'),
                lastName: pick(m, 'LastName', 'lastName'),
            })));
            const byUser = {};
            (chr?.characters || []).forEach((c) => {
                if (!c.userId) return;
                (byUser[String(c.userId)] = byUser[String(c.userId)] || []).push(c);
            });
            setCharsByUser(byUser);
        } catch (e) {
            setError(e?.message || 'Failed to load members.');
        } finally { setLoading(false); }
    }, [bastionId, campaignId]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const run = async (fn) => {
        setBusy(true); setError('');
        try { await fn(); await load(); }
        catch (e) { setError(e?.message || 'Something went wrong.'); }
        finally { setBusy(false); }
    };

    const levelOptions = useMemo(() => ['Read', 'Use', ...(canGrantManage ? ['Manage'] : [])], [canGrantManage]);

    const memberUserIds = useMemo(() => new Set(members.map((m) => String(m.userId))), [members]);
    const addablePlayers = useMemo(() => players.filter((p) => !memberUserIds.has(p.userId)), [players, memberUserIds]);

    const addMember = () => {
        if (!addUser) return;
        run(async () => { await BastionService.upsertMember(bastionId, { userId: addUser, accessLevel: addLevel }); setAddUser(''); setAddLevel('Use'); });
    };
    const changeLevel = (m, level) => run(() => BastionService.upsertMember(bastionId, { userId: m.userId, accessLevel: level }));
    const removeMember = (m) => run(() => BastionService.removeMember(bastionId, m.userId));
    const setChars = (m, ids) => run(() => BastionService.setMemberCharacters(bastionId, m.userId, ids));

    const renderMember = (m) => {
        const isOwner = m.accessLevel === 'Owner';
        const myChars = charsByUser[String(m.userId)] || [];
        const assignedIds = (m.characters || []).map((c) => c.id);
        return (
            <Paper key={m.userId} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>{playerName(m)}</Typography>
                        <Typography variant="caption" color="text.secondary">{m.email}</Typography>
                    </Box>
                    {isOwner ? (
                        <Chip size="small" color="primary" label="Owner" />
                    ) : (
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                            <Select value={m.accessLevel} onChange={(e) => changeLevel(m, e.target.value)} disabled={busy}>
                                {[...new Set([...levelOptions, m.accessLevel])].map((l) => (
                                    <MenuItem key={l} value={l} disabled={l === 'Manage' && !canGrantManage}>{l}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    {!isOwner && (
                        <Tooltip title="Remove from bastion">
                            <span><IconButton size="small" color="error" onClick={() => removeMember(m)} disabled={busy}>🗑</IconButton></span>
                        </Tooltip>
                    )}
                </Stack>
                <FormControl size="small" fullWidth>
                    <InputLabel>Assigned characters</InputLabel>
                    <Select multiple value={assignedIds} input={<OutlinedInput label="Assigned characters" />}
                        onChange={(e) => setChars(m, e.target.value)} disabled={busy || myChars.length === 0}
                        renderValue={(sel) => myChars.filter((c) => sel.includes(c.id)).map((c) => c.name).join(', ') || (myChars.length ? '' : 'No characters')}>
                        {myChars.length === 0 && <MenuItem disabled value="">This player has no characters</MenuItem>}
                        {myChars.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                                <Checkbox size="small" checked={assignedIds.includes(c.id)} />
                                <ListItemText primary={c.name} secondary={c.isActive ? null : 'retired'} />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Paper>
        );
    };

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Members — {bastionName}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

                {loading && members.length === 0 ? (
                    <PotionLoader label="Loading members…" minHeight={160} />
                ) : (
                    <>
                        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Add a player</Typography>
                            <Stack direction="row" spacing={1}>
                                <FormControl size="small" sx={{ flex: 1 }}>
                                    <InputLabel>Player</InputLabel>
                                    <Select label="Player" value={addUser} onChange={(e) => setAddUser(e.target.value)} disabled={busy}>
                                        {addablePlayers.length === 0 && <MenuItem disabled value="">Everyone's already added</MenuItem>}
                                        {addablePlayers.map((p) => <MenuItem key={p.userId} value={p.userId}>{playerName(p)}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 110 }}>
                                    <InputLabel>Access</InputLabel>
                                    <Select label="Access" value={addLevel} onChange={(e) => setAddLevel(e.target.value)} disabled={busy}>
                                        {levelOptions.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <Button variant="contained" onClick={addMember} disabled={busy || !addUser}>Add</Button>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                Read = view · Use = view + spend · Manage = full build{canGrantManage ? '' : ' (Owner only)'}. Assign characters after adding.
                            </Typography>
                        </Paper>

                        {loading && <PotionLoader label="Refreshing…" minHeight={60} />}
                        <Divider sx={{ mb: 1.5 }}><Typography variant="caption" color="text.secondary">Members</Typography></Divider>
                        {members.length === 0
                            ? <Typography color="text.secondary">No one added yet.</Typography>
                            : members.map(renderMember)}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
