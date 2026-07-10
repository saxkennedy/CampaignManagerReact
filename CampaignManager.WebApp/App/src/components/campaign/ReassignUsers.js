import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Chip, Button,
    FormControl, Select, MenuItem, InputLabel, Paper, Table, TableBody, TableCell,
    TableHead, TableRow, TableContainer, TableSortLabel, TextField, Dialog, DialogContent,
} from '@mui/material';
import CampaignAdminService from '../../api/CampaignAdminService';
import PotionLoader from '../utilities/PotionLoader';
import UserCharactersDialog from './UserCharactersDialog';

const pick = (o, P, c) => o?.[P] ?? o?.[c];

const ReassignUsers = ({ campaignId, canManageCharacters = false }) => {
    const [charsFor, setCharsFor] = useState(null); // member whose character modal is open
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [members, setMembers] = useState([]);
    const [personas, setPersonas] = useState([]);
    const [actorLevel, setActorLevel] = useState(Infinity);
    const [pending, setPending] = useState({}); // userId -> target personaId
    const [saving, setSaving] = useState(false);

    // Toolbar
    const [search, setSearch] = useState('');
    const [personaFilter, setPersonaFilter] = useState('all'); // personaId or 'all'
    const [sortBy, setSortBy] = useState('persona');           // 'member' | 'persona'
    const [sortDir, setSortDir] = useState('asc');             // 'asc' | 'desc'

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const resp = await CampaignAdminService.getMembers(campaignId);
            setMembers((pick(resp, 'Members', 'members') || []).map((m) => ({
                userId: String(pick(m, 'UserId', 'userId')),
                email: pick(m, 'Email', 'email'),
                firstName: pick(m, 'FirstName', 'firstName'),
                lastName: pick(m, 'LastName', 'lastName'),
                personaId: String(pick(m, 'CampaignPersonaId', 'campaignPersonaId')),
                personaName: pick(m, 'PersonaName', 'personaName'),
                hierarchy: Number(pick(m, 'Hierarchy', 'hierarchy')),
            })));
            setPersonas((pick(resp, 'Personas', 'personas') || []).map((p) => ({
                id: String(pick(p, 'Id', 'id')),
                name: pick(p, 'DisplayName', 'displayName'),
                hierarchy: Number(pick(p, 'Hierarchy', 'hierarchy')),
            })));
            const lvl = Number(pick(resp, 'ActorLevel', 'actorLevel'));
            setActorLevel(Number.isFinite(lvl) ? lvl : Infinity);
            setPending({});
        } catch (e) {
            setError(e?.message || 'Failed to load members.');
        } finally {
            setLoading(false);
        }
    }, [campaignId]);

    useEffect(() => { load(); }, [load]);

    // Personas an actor may move members into: strictly below the actor's own level.
    const targetPersonas = useMemo(
        () => personas.filter((p) => p.hierarchy > actorLevel),
        [personas, actorLevel]
    );

    const canMoveMember = (m) => m.hierarchy > actorLevel;

    const memberName = (m) => {
        const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
        return name || m.email;
    };

    // Distinct current personas present among members, for the filter dropdown.
    const currentPersonaOptions = useMemo(() => {
        const map = new Map();
        for (const m of members) {
            if (!map.has(m.personaId)) map.set(m.personaId, `${m.personaName} (Rank ${m.hierarchy})`);
        }
        return Array.from(map, ([id, label]) => ({ id, label }));
    }, [members]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = members.filter((m) => {
            if (personaFilter !== 'all' && m.personaId !== personaFilter) return false;
            if (!q) return true;
            return memberName(m).toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
        });
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            if (sortBy === 'member') return dir * memberName(a).localeCompare(memberName(b));
            if (a.hierarchy !== b.hierarchy) return dir * (a.hierarchy - b.hierarchy);
            return dir * (a.personaName || '').localeCompare(b.personaName || '');
        });
    }, [members, search, personaFilter, sortBy, sortDir]);

    const setSort = (col) => {
        if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortBy(col); setSortDir('asc'); }
    };

    // Real, valid pending moves (target differs from current and is allowed).
    const pendingChanges = useMemo(() => {
        const out = [];
        for (const m of members) {
            const to = pending[m.userId];
            if (!to || to === m.personaId) continue;
            if (!canMoveMember(m)) continue;
            if (!targetPersonas.some((p) => p.id === to)) continue;
            out.push({ userId: m.userId, toPersonaId: to });
        }
        return out;
    }, [pending, members, targetPersonas, actorLevel]);

    const saveAll = async () => {
        if (pendingChanges.length === 0) return;
        try {
            setSaving(true);
            setError('');
            for (const ch of pendingChanges) {
                await CampaignAdminService.reassignMember(campaignId, {
                    UserId: ch.userId,
                    ToPersonaId: ch.toPersonaId,
                });
            }
            await load();
        } catch (e) {
            setError(e?.message || 'Failed to save reassignments.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PotionLoader label="Loading members…" />;

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
                <Typography variant="h6">Reassign Members</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="outlined" onClick={() => setPending({})} disabled={pendingChanges.length === 0 || saving}>
                    Discard
                </Button>
                <Button variant="contained" onClick={saveAll} disabled={pendingChanges.length === 0 || saving}>
                    {saving ? 'Saving…' : `Save changes${pendingChanges.length ? ` (${pendingChanges.length})` : ''}`}
                </Button>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                    size="small"
                    label="Search members"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ minWidth: 240 }}
                />
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="persona-filter-label">Filter by persona</InputLabel>
                    <Select
                        labelId="persona-filter-label"
                        label="Filter by persona"
                        value={personaFilter}
                        onChange={(e) => setPersonaFilter(e.target.value)}
                    >
                        <MenuItem value="all"><em>All personas</em></MenuItem>
                        {currentPersonaOptions.map((o) => (
                            <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>

            {members.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No members in this campaign yet.</Typography>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sortDirection={sortBy === 'member' ? sortDir : false}>
                                    <TableSortLabel
                                        active={sortBy === 'member'}
                                        direction={sortBy === 'member' ? sortDir : 'asc'}
                                        onClick={() => setSort('member')}
                                    >
                                        Member
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sortDirection={sortBy === 'persona' ? sortDir : false}>
                                    <TableSortLabel
                                        active={sortBy === 'persona'}
                                        direction={sortBy === 'persona' ? sortDir : 'asc'}
                                        onClick={() => setSort('persona')}
                                    >
                                        Current Persona
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>Move To</TableCell>
                                {canManageCharacters && <TableCell align="right">Characters</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map((m) => {
                                const movable = canMoveMember(m);
                                const options = targetPersonas.filter((p) => p.id !== m.personaId);
                                const selected = pending[m.userId] ?? '';
                                const isPending = selected && selected !== m.personaId;
                                return (
                                    <TableRow
                                        key={`${m.userId}-${m.personaId}`}
                                        sx={isPending ? { backgroundColor: 'action.selected' } : undefined}
                                    >
                                        <TableCell>
                                            <Typography sx={{ fontWeight: 600 }}>{memberName(m)}</Typography>
                                            <Typography variant="body2" color="text.secondary">{m.email}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="small" label={`${m.personaName} (Rank ${m.hierarchy})`} />
                                        </TableCell>
                                        <TableCell>
                                            <FormControl size="small" sx={{ minWidth: 200 }} disabled={!movable || options.length === 0}>
                                                <Select
                                                    displayEmpty
                                                    value={selected}
                                                    onChange={(e) => setPending((prev) => ({ ...prev, [m.userId]: e.target.value }))}
                                                >
                                                    <MenuItem value=""><em>Select persona…</em></MenuItem>
                                                    {options.map((p) => (
                                                        <MenuItem key={p.id} value={p.id}>{p.name} (Rank {p.hierarchy})</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </TableCell>
                                        {canManageCharacters && (
                                            <TableCell align="right">
                                                <Button size="small" variant="outlined" onClick={() => setCharsFor(m)}>
                                                    Characters
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}
                            {visible.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={canManageCharacters ? 4 : 3}>
                                        <Typography variant="body2" color="text.secondary">No members match your filters.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                You can only move members below your own level, and only into personas below your own level.
                Queue changes across rows, then Save.
            </Typography>

            <Dialog open={saving}>
                <DialogContent>
                    <PotionLoader label="Saving reassignments…" minHeight={120} />
                </DialogContent>
            </Dialog>

            {canManageCharacters && (
                <UserCharactersDialog
                    open={!!charsFor}
                    member={charsFor ? { userId: charsFor.userId, label: memberName(charsFor), email: charsFor.email } : null}
                    campaignId={campaignId}
                    onClose={() => setCharsFor(null)}
                    onSaved={load}
                />
            )}
        </Box>
    );
};

export default ReassignUsers;
