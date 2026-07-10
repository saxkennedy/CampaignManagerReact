import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Chip,
} from '@mui/material';
import CharacterService from '../../api/CharacterService';

// Lightweight self-service: a player renames the characters they own in this campaign.
// (Creating / assigning / deleting characters stays with the DM in Campaign Administration.)
const MyCharacters = ({ campaignId, open, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [mine, setMine] = useState([]);
    const [drafts, setDrafts] = useState({});

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const resp = await CharacterService.listCharacters(campaignId);
            const myId = resp?.myUserId ? String(resp.myUserId) : null;
            setMine((resp?.characters || []).filter((c) => c.userId && String(c.userId) === myId));
            setDrafts({});
        } catch (e) {
            setError(e?.message || 'Failed to load your characters.');
        } finally {
            setLoading(false);
        }
    }, [campaignId]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const rename = async (c) => {
        const name = (drafts[c.id] ?? c.name).trim();
        if (!name || name === c.name) return;
        setBusyId(c.id); setError('');
        try {
            await CharacterService.updateCharacter(c.id, { name });
            await load();
        } catch (e) {
            setError(e?.message || 'Failed to rename.');
        } finally {
            setBusyId(null);
        }
    };

    const active = useMemo(() => mine.filter((c) => c.isActive), [mine]);
    const retired = useMemo(() => mine.filter((c) => !c.isActive), [mine]);

    const row = (c) => (
        <Box key={c.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
                size="small" fullWidth
                value={drafts[c.id] ?? c.name}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                onBlur={() => rename(c)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rename(c); } }}
                disabled={busyId === c.id}
                InputProps={{ sx: c.isActive ? undefined : { textDecoration: 'line-through', opacity: 0.6 } }}
            />
            {busyId === c.id && <CircularProgress size={18} />}
        </Box>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>My Characters</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
                ) : mine.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        You have no characters in this campaign yet. Your DM assigns characters to you.
                    </Typography>
                ) : (
                    <Stack spacing={1.5}>
                        {active.map(row)}
                        {retired.length > 0 && (
                            <>
                                <Chip size="small" label="Retired" sx={{ alignSelf: 'flex-start', mt: 1 }} />
                                {retired.map(row)}
                            </>
                        )}
                        <Typography variant="caption" color="text.secondary">
                            Edit a name and press Enter (or click away) to save. Need a new character, or one retired/removed? Ask your DM.
                        </Typography>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default MyCharacters;
