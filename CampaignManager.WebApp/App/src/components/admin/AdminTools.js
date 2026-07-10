import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Stack,
    Alert,
    Chip,
    CircularProgress,
    Divider,
    TextField,
} from '@mui/material';
import AdminService from '../../api/AdminService';

// Renders the result summary of a data-tool run.
function SeedResult({ result }) {
    return (
        <Alert severity="success" sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: result.excludedCount ? 1 : 0 }}>
                <Chip size="small" color="success" label={`${result.inserted} added`} />
                <Chip size="small" color="primary" label={`${result.updated} updated`} />
                <Chip size="small" label={`${result.unchanged} unchanged`} />
                <Chip size="small" variant="outlined" label={`${result.total} total`} />
                {result.excludedCount > 0 && (
                    <Chip size="small" variant="outlined" color="warning" label={`${result.excludedCount} skipped`} />
                )}
            </Stack>
            {result.excludedCount > 0 && (
                <Typography variant="caption" color="text.secondary">
                    Skipped (non Core/Supplements source): {result.excluded.join(', ')}
                </Typography>
            )}
        </Alert>
    );
}

// A single data-tool: a button that runs an async action and reports status/result inline.
function ToolCard({ title, description, actionLabel, run, renderResult }) {
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const onRun = async () => {
        setRunning(true);
        setError('');
        setResult(null);
        try {
            setResult(await run());
        } catch (e) {
            setError(e.message || 'Something went wrong.');
        } finally {
            setRunning(false);
        }
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
            {description && (
                <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>{description}</Typography>
            )}
            <Button
                variant="contained"
                onClick={onRun}
                disabled={running}
                startIcon={running ? <CircularProgress size={18} color="inherit" /> : null}
            >
                {running ? 'Running…' : actionLabel}
            </Button>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {result && (renderResult ? renderResult(result) : null)}
        </Paper>
    );
}

// Sends a test email so an admin can confirm SMTP works without running the whole
// signup/reset flow. Reports the exact outcome (including the raw provider error).
function TestEmailCard({ defaultTo }) {
    const [to, setTo] = useState(defaultTo || '');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const onSend = async () => {
        setRunning(true);
        setError('');
        setResult(null);
        try {
            setResult(await AdminService.sendTestEmail(to.trim()));
        } catch (e) {
            setError(e.message || 'Send failed.');
        } finally {
            setRunning(false);
        }
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Send Test Email</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                Verifies outbound email (SMTP) is working. Sends a real message and reports the exact
                result — including the provider error if it fails.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                <TextField
                    label="Recipient"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="you@example.com"
                />
                <Button
                    variant="contained"
                    onClick={onSend}
                    disabled={running || !to.trim()}
                    startIcon={running ? <CircularProgress size={18} color="inherit" /> : null}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    {running ? 'Sending…' : 'Send Test Email'}
                </Button>
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {result?.sent && <Alert severity="success" sx={{ mt: 2 }}>Sent to {result.to}.</Alert>}
        </Paper>
    );
}

export const AdminTools = ({ user }) => {
    // Server-side is the real gate (endpoints require the Administrator site persona);
    // this is just so non-admins who reach the URL see nothing actionable.
    if (user?.SitePersonaName !== 'Administrator') {
        return (
            <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
                <Alert severity="error">Administrator access required.</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>Data Tools</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Maintenance actions that fetch and refresh site reference data.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Stack spacing={3}>
                <ToolCard
                    title="Update Bastion Facilities"
                    description="Fetches the latest bastion facilities from the 5etools source data and upserts the catalog. Existing entries are updated in place; new ones are added."
                    actionLabel="Update Bastion Facilities"
                    run={() => AdminService.runBastionFacilitySeed()}
                    renderResult={(result) => <SeedResult result={result} />}
                />

                <TestEmailCard defaultTo={user.Email} />
            </Stack>
        </Box>
    );
};

export default AdminTools;
