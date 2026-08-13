import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserService from '../api/UserService';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import {
    authCardSx,
    authTitleSx,
    authBodySx,
    darkFieldSx,
    goldButtonSx,
    soulslike,
} from '../theme/soulslike';

export const ChangePassword = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirm) {
            setError('New passwords do not match.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await UserService.ChangePassword(currentPassword, newPassword);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{
            backgroundColor: soulslike.void,
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pt: '4vh', // offset for fixed navbar
        }}>
            <Box sx={{ ...authCardSx, width: { xs: '92%', sm: 440 } }}>
                <Typography variant="h4" gutterBottom sx={authTitleSx}>
                    Change Password
                </Typography>
                <Typography variant="body2" sx={authBodySx}>
                    Enter your current password, then choose a new one.
                </Typography>

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <TextField
                        label="Current password"
                        type="password"
                        required
                        fullWidth
                        margin="normal"
                        sx={darkFieldSx}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoFocus
                    />
                    <TextField
                        label="New password"
                        type="password"
                        required
                        fullWidth
                        margin="normal"
                        sx={darkFieldSx}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <TextField
                        label="Confirm new password"
                        type="password"
                        required
                        fullWidth
                        margin="normal"
                        sx={darkFieldSx}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                    />
                    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
                    <Button
                        fullWidth
                        variant="contained"
                        type="submit"
                        disabled={submitting}
                        size="large"
                        sx={{ ...goldButtonSx, mt: 3, py: 1.5 }}
                    >
                        Update Password
                    </Button>
                    <Button
                        fullWidth
                        variant="text"
                        onClick={() => navigate('/dashboard')}
                        sx={{ mt: 1 }}
                    >
                        Cancel
                    </Button>
                </form>
            </Box>
        </Box>
    );
};

export default ChangePassword;
