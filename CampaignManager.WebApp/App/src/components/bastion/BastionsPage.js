import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Paper, Typography, Button, TextField, Stack, Alert, Chip,
    List, ListItemButton, ListItemText, CircularProgress, Divider, IconButton, Collapse,
} from '@mui/material';
import BastionService from '../../api/BastionService';
import BastionTurns from './BastionTurns';
import BastionBankPanel from './BastionBankPanel';
import BastionMembers from './BastionMembers';
import ConfirmDialog from '../utilities/ConfirmDialog';

export default function BastionsPage() {
    const { campaignId } = useParams();
    const navigate = useNavigate();

    const [bastions, setBastions] = useState([]);
    const [canCreate, setCanCreate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [turnsFor, setTurnsFor] = useState(null); // bastion whose Segments dialog is open
    const [membersFor, setMembersFor] = useState(null); // bastion whose Members dialog is open
    const [confirmDelete, setConfirmDelete] = useState(null); // bastion pending deletion
    const [deleting, setDeleting] = useState(false);
    const [expanded, setExpanded] = useState(null); // bastion id whose bank panel is open

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await BastionService.listBastions(campaignId);
            setBastions(data.bastions || []);
            setCanCreate(!!data.canCreate);
        } catch (e) {
            setError(e.message || 'Failed to load bastions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [campaignId]);

    const create = async () => {
        const name = newName.trim();
        if (!name) return;
        setCreating(true);
        setError('');
        try {
            const b = await BastionService.createBastion(campaignId, { name });
            setNewName('');
            navigate(`/campaigns/${campaignId}/bastions/${b.id}`);
        } catch (e) {
            setError(e.message || 'Failed to create bastion.');
        } finally {
            setCreating(false);
        }
    };

    const doDelete = async () => {
        if (!confirmDelete) return;
        setDeleting(true);
        setError('');
        try {
            await BastionService.deleteBastion(confirmDelete.id);
            setBastions((bs) => bs.filter((b) => b.id !== confirmDelete.id));
            setConfirmDelete(null);
        } catch (err) {
            setError(err.message || 'Delete failed.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#FCF5E5' }}>
        <Box sx={{ pt: { xs: 8, sm: 9 }, px: 3, pb: 4, maxWidth: 760, mx: 'auto' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Button size="small" onClick={() => navigate(`/campaigns/${campaignId}`)}>← Campaign</Button>
                <Typography variant="h4">Bastions</Typography>
            </Stack>

            {error && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            {canCreate && (
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>New bastion</Typography>
                    <Stack direction="row" spacing={1}>
                        <TextField size="small" fullWidth label="Name" value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && create()} />
                        <Button variant="contained" onClick={create} disabled={creating || !newName.trim()}>
                            {creating ? '…' : 'Create'}
                        </Button>
                    </Stack>
                </Paper>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : bastions.length === 0 ? (
                <Typography color="text.secondary">
                    {canCreate ? 'No bastions yet — create one above.' : 'No bastions have been shared with you.'}
                </Typography>
            ) : (
                <Paper>
                    <List disablePadding>
                        {bastions.map((b, i) => (
                            <React.Fragment key={b.id}>
                                {i > 0 && <Divider />}
                                <ListItemButton onClick={() => navigate(`/campaigns/${campaignId}/bastions/${b.id}`)}>
                                    <ListItemText
                                        primary={b.name}
                                        secondary={`${b.roomCount} element${b.roomCount === 1 ? '' : 's'} · ${b.maxWidth}×${b.maxHeight} sq`}
                                    />
                                    <Chip size="small" label={b.accessLevel}
                                        color={['Manage', 'Owner'].includes(b.accessLevel) ? 'primary' : 'default'} sx={{ mr: 1 }} />
                                    <Button size="small" variant="outlined" sx={{ mr: 1 }}
                                        onClick={(e) => { e.stopPropagation(); setTurnsFor(b); }}>
                                        Segments
                                    </Button>
                                    {['Manage', 'Owner'].includes(b.accessLevel) && (
                                        <Button size="small" variant="outlined" sx={{ mr: 1 }}
                                            onClick={(e) => { e.stopPropagation(); setMembersFor(b); }}>
                                            Members
                                        </Button>
                                    )}
                                    <Button size="small" sx={{ mr: 0.5 }} title="Banked time"
                                        endIcon={<span>{expanded === b.id ? '▾' : '▸'}</span>}
                                        onClick={(e) => { e.stopPropagation(); setExpanded((id) => (id === b.id ? null : b.id)); }}>
                                        {`${b.activeSegmentCount ?? 0} Active Segment${(b.activeSegmentCount ?? 0) === 1 ? '' : 's'}`}
                                    </Button>
                                    {b.accessLevel === 'Owner' && (
                                        <IconButton size="small" color="error"
                                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(b); }} title="Delete">✕</IconButton>
                                    )}
                                </ListItemButton>
                                <Collapse in={expanded === b.id} unmountOnExit>
                                    <Box sx={{ px: 3, py: 2, bgcolor: 'action.hover' }}>
                                        <BastionBankPanel bastionId={b.id} />
                                    </Box>
                                </Collapse>
                            </React.Fragment>
                        ))}
                    </List>
                </Paper>
            )}

            {turnsFor && (
                <BastionTurns
                    open={!!turnsFor}
                    bastionId={turnsFor.id}
                    bastionName={turnsFor.name}
                    campaignId={campaignId}
                    onClose={() => { setTurnsFor(null); load(); }}
                />
            )}

            {membersFor && (
                <BastionMembers
                    open={!!membersFor}
                    bastionId={membersFor.id}
                    bastionName={membersFor.name}
                    campaignId={campaignId}
                    onClose={() => setMembersFor(null)}
                />
            )}

            <ConfirmDialog
                open={!!confirmDelete}
                title="Delete bastion?"
                message={confirmDelete ? `Delete “${confirmDelete.name}” and its entire layout? This cannot be undone.` : null}
                confirmLabel="Delete"
                confirmColor="error"
                busy={deleting}
                onConfirm={doDelete}
                onClose={() => setConfirmDelete(null)}
            />
        </Box>
        </Box>
    );
}
