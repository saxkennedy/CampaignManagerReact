import React, { useEffect, useMemo, useState } from 'react';
import {
    Box, FormControl, InputLabel, MenuItem, Select, Typography, Paper,
    Alert, Stack, CircularProgress,
} from '@mui/material';
import BastionFacilityService from '../../api/BastionFacilityService';
import FacilityDetail from '../bastion/FacilityDetail';

export const BastionFacilities = () => {
    const [facilities, setFacilities] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const data = await BastionFacilityService.listFacilities();
                if (active) setFacilities(Array.isArray(data) ? data : []);
            } catch (e) {
                if (active) setError(e.message || 'Failed to load bastion facilities.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const selected = useMemo(
        () => facilities.find(f => f.id === selectedId) || null,
        [facilities, selectedId]
    );

    return (
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>Bastion Facilities</Typography>

            {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

            <FormControl fullWidth sx={{ mb: 3 }} disabled={loading || !!error}>
                <InputLabel>Facility</InputLabel>
                <Select
                    value={selectedId}
                    label="Facility"
                    onChange={e => setSelectedId(e.target.value)}
                >
                    {facilities.map(f => (
                        <MenuItem key={f.id} value={f.id}>
                            {f.name}{f.facilityType ? ` (${f.facilityType})` : ''}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {loading && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <CircularProgress size={20} />
                    <Typography color="text.secondary">Loading facilities…</Typography>
                </Stack>
            )}

            {selected && (
                <Paper sx={{ p: 3 }}>
                    <FacilityDetail facility={selected} />
                </Paper>
            )}
        </Box>
    );
};

export default BastionFacilities;
