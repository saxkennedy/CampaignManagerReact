import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, Chip, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ActivityService from '../../api/ActivityService';
import PotionLoader from '../utilities/PotionLoader';

const scheduleText = (a) => a.startDay == null ? 'unscheduled' : `day ${a.startDay}${a.durationDays > 1 ? `–${a.startDay + a.durationDays - 1}` : ''}`;

// The player's own planned/scheduled actions across this bastion's segments, grouped by
// segment (the open one expanded first). Cancelled actions are excluded server-side.
export default function MyActionsDialog({ open, onClose, bastionId }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [segments, setSegments] = useState([]);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError('');
            const resp = await ActivityService.listMine(bastionId);
            setSegments(resp?.segments || []);
        } catch (e) {
            setError(e?.message || 'Failed to load your actions.');
        } finally { setLoading(false); }
    }, [bastionId]);

    useEffect(() => { if (open) load(); }, [open, load]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>My Actions</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                {loading ? (
                    <PotionLoader label="Gathering your plans…" minHeight={160} />
                ) : segments.length === 0 ? (
                    <Typography color="text.secondary">You haven't planned anything here yet.</Typography>
                ) : (
                    segments.map((s, idx) => (
                        <Accordion key={s.segmentId} defaultExpanded={idx === 0} disableGutters>
                            <AccordionSummary expandIcon={<span>▾</span>}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography sx={{ fontWeight: 700 }}>{s.title || 'Segment'}</Typography>
                                    <Chip size="small" label={s.status} color={s.status === 'Open' ? 'success' : 'default'} />
                                    <Typography variant="caption" color="text.secondary">{s.activities.length} action{s.activities.length === 1 ? '' : 's'}</Typography>
                                </Stack>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Stack spacing={1}>
                                    {s.activities.map((a) => (
                                        <Paper key={a.id} variant="outlined" sx={{ p: 1 }}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Chip size="small" variant="outlined"
                                                    color={a.actionKind === 'order' ? 'primary' : 'secondary'}
                                                    label={a.actionKind === 'order' ? (a.orderType || 'order') : 'special'} />
                                                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>{a.characterName}</Typography>
                                                {a.status !== 'Planned' && <Chip size="small" label={a.status} color={a.status === 'Completed' ? 'success' : 'default'} />}
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary">
                                                {a.title || (a.actionKind === 'order' ? 'Order' : 'Special')} · in <strong>{a.roomName || 'room'}</strong> ·{' '}
                                                {a.turnsCost > 0 ? `${a.turnsCost} turn(s)` : `${a.longRestsCost} rest(s)`} · {scheduleText(a)}
                                            </Typography>
                                            {(a.hirelings || []).length > 0 && (
                                                <Box sx={{ mt: 0.25, display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
                                                    {a.hirelings.map((h) => <Chip key={h.id} size="small" label={h.name} />)}
                                                </Box>
                                            )}
                                            {a.resultSummary && <Alert severity="success" icon={false} sx={{ py: 0, mt: 0.5 }}>{a.resultSummary}</Alert>}
                                        </Paper>
                                    ))}
                                </Stack>
                            </AccordionDetails>
                        </Accordion>
                    ))
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
