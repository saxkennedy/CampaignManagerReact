import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Chip, CircularProgress, Divider } from '@mui/material';
import BastionTurnService from '../../api/BastionTurnService';

// Aggregate a user's available "bank" across all OPEN segments of a bastion:
// per owned character, the total turns / days / long-rests still granted.
export function computeMyBank(segments, myUserId) {
    const byChar = new Map();
    for (const s of segments || []) {
        if (s.status !== 'Open') continue;
        for (const c of s.characters || []) {
            if (!myUserId || String(c.ownerUserId) !== String(myUserId)) continue;
            const cur = byChar.get(c.characterId) || { name: c.name, turns: 0, days: 0, longRests: 0 };
            cur.turns += s.turnsGranted;
            cur.days += s.daysGranted;
            cur.longRests += s.longRestsTotal;
            byChar.set(c.characterId, cur);
        }
    }
    return Array.from(byChar.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const BudgetLine = ({ b }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>{b.name}</Typography>
        <Typography variant="body2" color="text.secondary">
            <strong>{b.turns}</strong> turn{b.turns === 1 ? '' : 's'} ·{' '}
            <strong>{b.days}</strong> day{b.days === 1 ? '' : 's'} ·{' '}
            <strong>{b.longRests}</strong> long rest{b.longRests === 1 ? '' : 's'}
        </Typography>
    </Box>
);

// Shows the current user's banked bastion time. Pass preloaded `segments`+`myUserId`
// (e.g. from the Turns modal) or just a `bastionId` to have it fetch on its own.
export default function BastionBankPanel({ bastionId, segments: segmentsProp, myUserId: myUserIdProp, title = 'Your bank', compact = false }) {
    const [loading, setLoading] = useState(!segmentsProp);
    const [error, setError] = useState('');
    const [segments, setSegments] = useState(segmentsProp || []);
    const [myUserId, setMyUserId] = useState(myUserIdProp || null);

    const load = useCallback(async () => {
        if (segmentsProp) return; // driven by props
        try {
            setLoading(true);
            setError('');
            const resp = await BastionTurnService.listSegments(bastionId);
            setSegments(resp?.segments || []);
            setMyUserId(resp?.myUserId ? String(resp.myUserId) : null);
        } catch (e) {
            setError(e?.message || 'Failed to load bank.');
        } finally {
            setLoading(false);
        }
    }, [bastionId, segmentsProp]);

    useEffect(() => {
        if (segmentsProp) { setSegments(segmentsProp); setMyUserId(myUserIdProp || null); setLoading(false); }
        else load();
    }, [segmentsProp, myUserIdProp, load]);

    const bank = useMemo(() => computeMyBank(segments, myUserId), [segments, myUserId]);
    const openCount = useMemo(() => (segments || []).filter((s) => s.status === 'Open').length, [segments]);

    // Compact one-line variant for toolbars — shows the numbers with no button/click.
    if (compact) {
        if (loading || error) return null;
        if (bank.length === 0) return <Typography variant="caption" color="text.secondary">🏦 No banked time</Typography>;
        return (
            <Typography variant="body2" noWrap sx={{ maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <strong>🏦 Bank:</strong>{' '}
                {bank.map((b) => `${b.name} ${b.turns}t·${b.days}d·${b.longRests}r`).join('   ·   ')}
            </Typography>
        );
    }

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>;
    if (error) return <Typography variant="body2" color="error">{error}</Typography>;

    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
                <Chip size="small" label={`${openCount} active segment${openCount === 1 ? '' : 's'}`} />
            </Stack>
            {bank.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No active bastion time banked for your characters here.
                </Typography>
            ) : (
                <Stack spacing={0.75} divider={<Divider flexItem />}>
                    {bank.map((b, i) => <BudgetLine key={i} b={b} />)}
                </Stack>
            )}
        </Box>
    );
}
