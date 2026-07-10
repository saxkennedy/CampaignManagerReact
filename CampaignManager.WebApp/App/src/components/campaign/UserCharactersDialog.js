import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box, Stack, Typography, Alert, Button, IconButton, TextField, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
} from '@mui/material';
import CharacterService from '../../api/CharacterService';

let tmpSeq = 0;
const tmpKey = () => `new_${Date.now()}_${tmpSeq++}`;

// Per-player character editor: add / rename / delete this user's characters, then Save.
// Changes are staged locally and committed as one batch on Save.
const UserCharactersDialog = ({ open, onClose, campaignId, member, onSaved }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [rows, setRows] = useState([]);        // { key, id, name, deleted }
    const originalNames = useRef(new Map());       // id -> original name

    const userId = member?.userId ? String(member.userId) : null;

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const resp = await CharacterService.listCharacters(campaignId);
            const mine = (resp?.characters || []).filter(
                (c) => (c.userId ? String(c.userId) : null) === userId
            );
            originalNames.current = new Map(mine.map((c) => [c.id, c.name]));
            setRows(mine.map((c) => ({ key: c.id, id: c.id, name: c.name, deleted: false })));
        } catch (e) {
            setError(e?.message || 'Failed to load characters.');
        } finally {
            setLoading(false);
        }
    }, [campaignId, userId]);

    useEffect(() => { if (open) load(); }, [open, load]);

    const addRow = () => setRows((r) => [...r, { key: tmpKey(), id: null, name: '', deleted: false }]);
    const setName = (key, name) => setRows((r) => r.map((x) => (x.key === key ? { ...x, name } : x)));
    const removeRow = (key) =>
        setRows((r) => r
            .map((x) => (x.key === key ? { ...x, deleted: true } : x))
            .filter((x) => !(x.deleted && x.id == null))); // brand-new rows just vanish
    const undoRemove = (key) => setRows((r) => r.map((x) => (x.key === key ? { ...x, deleted: false } : x)));

    const live = useMemo(() => rows.filter((r) => !r.deleted), [rows]);
    const hasEmpty = live.some((r) => !r.name.trim());

    const dirty = useMemo(() => {
        return rows.some((r) => {
            if (r.deleted) return r.id != null;                    // a real deletion
            if (r.id == null) return r.name.trim().length > 0;     // a real add
            return r.name.trim() !== (originalNames.current.get(r.id) || ''); // a rename
        });
    }, [rows]);

    const save = async () => {
        if (hasEmpty) { setError('Every character needs a name (or remove the empty row).'); return; }
        setSaving(true); setError('');
        try {
            for (const r of rows) {
                if (r.deleted) {
                    if (r.id != null) await CharacterService.deleteCharacter(r.id);
                } else if (r.id == null) {
                    await CharacterService.createCharacter(campaignId, { name: r.name.trim(), userId });
                } else if (r.name.trim() !== (originalNames.current.get(r.id) || '')) {
                    await CharacterService.updateCharacter(r.id, { name: r.name.trim() });
                }
            }
            if (onSaved) await onSaved();
            onClose();
        } catch (e) {
            setError(e?.message || 'Failed to save. Some changes may not have applied.');
            await load(); // resync to the server's truth
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Characters — {member?.label || 'Player'}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
                ) : (
                    <Stack spacing={1.25}>
                        {rows.length === 0 && (
                            <Typography variant="body2" color="text.secondary">No characters yet — add one below.</Typography>
                        )}
                        {rows.map((r) => (
                            <Box key={r.key} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                    size="small" fullWidth placeholder="Character name"
                                    value={r.name}
                                    onChange={(e) => setName(r.key, e.target.value)}
                                    disabled={saving || r.deleted}
                                    InputProps={r.deleted ? { sx: { textDecoration: 'line-through', opacity: 0.5 } } : undefined}
                                />
                                {r.deleted ? (
                                    <Button size="small" onClick={() => undoRemove(r.key)} disabled={saving}>Undo</Button>
                                ) : (
                                    <Tooltip title="Remove">
                                        <span><IconButton size="small" color="error" onClick={() => removeRow(r.key)} disabled={saving}>🗑</IconButton></span>
                                    </Tooltip>
                                )}
                            </Box>
                        ))}

                        <Box>
                            <Button size="small" onClick={addRow} disabled={saving}>+ Add character</Button>
                        </Box>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving || loading || !dirty || hasEmpty}>
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default UserCharactersDialog;
