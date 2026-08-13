import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import UserService from '../api/UserService';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import {
    authCardSx,
    authTitleSx,
    authBodySx,
    authLinkStyle,
    darkFieldSx,
    goldButtonSx,
} from '../theme/soulslike';

const bgStyle = {
    backgroundImage: 'url("/img/LoginBackground.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const cardSx = { ...authCardSx, width: { xs: '92%', sm: 440 } };

export const ResetPassword = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { email, code } = location.state || {};

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await UserService.ResetPassword(email, code, newPassword);
            navigate('/login', { state: { passwordReset: true } });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={bgStyle}>
            <Box sx={cardSx}>
                <Typography variant="h4" gutterBottom sx={authTitleSx}>
                    Reset your password
                </Typography>
                <Typography variant="body2" sx={authBodySx}>
                    Choose a new password for <strong>{email}</strong>
                </Typography>

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <TextField
                        label="New password"
                        type="password"
                        required
                        fullWidth
                        margin="normal"
                        sx={darkFieldSx}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoFocus
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
                        Reset Password
                    </Button>
                </form>

                <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                    <Link to="/login" style={authLinkStyle}>Back to login</Link>
                </Typography>
            </Box>
        </div>
    );
};

export default ResetPassword;
