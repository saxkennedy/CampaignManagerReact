import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserService from '../api/UserService';
import { Box, Typography, TextField, Button } from '@mui/material';
import {
    authBgStyle,
    authCardSx,
    authTitleSx,
    authBodySx,
    darkFieldSx,
    goldButtonSx,
    soulslike,
} from '../theme/soulslike';

export const VerifyEmail = () => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [resent, setResent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await UserService.VerifyEmail(email, code);
            navigate('/login', { state: { verified: true } });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        setError('');
        setResent(false);
        try {
            await UserService.ResendVerification(email);
            setResent(true);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={authBgStyle}>
            <Box sx={{ ...authCardSx, width: { xs: '92%', sm: 440 } }}>
                <Typography variant="h4" gutterBottom sx={authTitleSx}>Check your email</Typography>
                <Typography variant="body2" sx={authBodySx}>
                    We sent a 6-digit code to <strong>{email}</strong>
                </Typography>

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <TextField
                        label="Verification code"
                        required
                        fullWidth
                        margin="normal"
                        sx={darkFieldSx}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        inputProps={{ maxLength: 6 }}
                        autoFocus
                    />
                    {error && (
                        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                            {error}
                        </Typography>
                    )}
                    {resent && (
                        <Typography color="success.main" variant="body2" sx={{ mt: 1 }}>
                            Code resent — check your inbox.
                        </Typography>
                    )}
                    <Button
                        fullWidth
                        variant="contained"
                        type="submit"
                        disabled={submitting}
                        sx={{ ...goldButtonSx, mt: 3, py: 1.5 }}
                    >
                        Verify
                    </Button>
                    <Button
                        fullWidth
                        variant="text"
                        onClick={handleResend}
                        sx={{ mt: 1, color: soulslike.parchment, '&:hover': { color: soulslike.goldPale } }}
                    >
                        Resend code
                    </Button>
                </form>
            </Box>
        </div>
    );
};

export default VerifyEmail;
