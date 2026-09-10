import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, Chip, Paper, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ActivityService from '../../api/ActivityService';
import PotionLoader from '../utilities/PotionLoader';
import { WIDE_DIALOG_PROPS } from './dialogSizing';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const scheduleText = (a) =>
    a.startDay == null
        ? 'unscheduled'
        : `day ${a.startDay}${a.durationDays > 1 ? `–${a.startDay + a.durationDays - 1}` : ''}`;

const costText = (a) => {
    const parts = [];
    if (a.turnsCost > 0) parts.push(plural(a.turnsCost, 'turn'));
    if (a.longRestsCost > 0) parts.push(plural(a.longRestsCost, 'long rest'));
    return parts.join(', ') || 'no cost';
};

// The DM's readout for one segment: who spent what, which rooms they leaned on,
// and the actions behind those totals. Cancelled actions are listed but cost nothing,
// matching how the activities dialog counts a character's budget.
export default function SegmentLog({ open, onClose, segment }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [players, setPlayers] = useState([]);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError('');
            const resp = await ActivityService.getSegmentLog(segment.id);
            setPlayers(resp?.players || []);
        } catch (e) {
            setError(e?.message || 'Failed to load the segment log.');
        } finally { setLoading(false); }
    }, [segment.id]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const renderActivity = (a) => (
        <Box key={a.id} sx={{ pl: 1, py: 0.4, opacity: a.status === 'Cancelled' ? 0.6 : 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
                <Chip size="small" variant="outlined"
                    color={a.actionKind === 'order' ? 'primary' : 'secondary'}
                    label={a.actionKind === 'order' ? (a.orderType || 'order') : 'special'} />
                <Typography variant="body2" sx={{ flex: 1 }}>
                    {a.title || (a.actionKind === 'order' ? 'Order' : 'Special action')} · in <strong>{a.roomName || 'room'}</strong>
                </Typography>
                {a.status !== 'Planned' && (
                    <Chip size="small" label={a.status} color={a.status === 'Completed' ? 'success' : 'default'} />
                )}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                {costText(a)} · {scheduleText(a)}
                {(a.hirelings || []).length > 0 && ` · with ${a.hirelings.map((h) => h.name).join(', ')}`}
            </Typography>
            {a.resultSummary && (
                <Alert severity="success" icon={false} sx={{ py: 0, mt: 0.25 }}>{a.resultSummary}</Alert>
            )}
        </Box>
    );

    const renderPlayer = (p, idx) => (
        <Accordion key={p.userId || `unassigned-${idx}`} defaultExpanded={idx === 0} disableGutters>
            <AccordionSummary expandIcon={<span>▾</span>}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Typography sx={{ fontWeight: 700 }}>{p.playerName}</Typography>
                    <Chip size="small" label={plural(p.totals.actions, 'action')} />
                    {p.totals.turnsSpent > 0 && (
                        <Chip size="small" color="primary" variant="outlined" label={plural(p.totals.turnsSpent, 'turn')} />
                    )}
                    {p.totals.restsSpent > 0 && (
                        <Chip size="small" color="secondary" variant="outlined" label={plural(p.totals.restsSpent, 'long rest')} />
                    )}
                    {p.totals.completed > 0 && <Chip size="small" color="success" label={`${p.totals.completed} done`} />}
                    {p.totals.cancelled > 0 && <Chip size="small" label={`${p.totals.cancelled} cancelled`} />}
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                {(p.rooms || []).length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Rooms used</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            {p.rooms.map((r) => (
                                <Chip key={r.bastionRoomId} size="small" variant="outlined"
                                    label={`${r.roomName || 'room'} ×${r.uses}`} />
                            ))}
                        </Box>
                    </Box>
                )}

                <Stack spacing={1}>
                    {(p.characters || []).map((c) => (
                        <Paper key={c.characterId} variant="outlined" sx={{ p: 1 }}>
                            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.25 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{c.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {c.turnsSpent > 0 && plural(c.turnsSpent, 'turn')}
                                    {c.turnsSpent > 0 && c.restsSpent > 0 && ', '}
                                    {c.restsSpent > 0 && plural(c.restsSpent, 'long rest')}
                                    {c.turnsSpent === 0 && c.restsSpent === 0 && 'nothing spent'}
                                </Typography>
                            </Stack>
                            {(c.activities || []).map(renderActivity)}
                        </Paper>
                    ))}
                </Stack>
            </AccordionDetails>
        </Accordion>
    );

    return (
        <Dialog open={open} onClose={onClose} {...WIDE_DIALOG_PROPS}>
            <DialogTitle>Log — {segment.title || 'Segment'}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

                {loading ? (
                    <PotionLoader label="Reading the ledger…" minHeight={160} />
                ) : players.length === 0 ? (
                    <Typography color="text.secondary">Nothing has been spent in this segment yet.</Typography>
                ) : (
                    <>
                        <Divider sx={{ mb: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">By player</Typography>
                        </Divider>
                        {players.map(renderPlayer)}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
