import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserService from '../api/UserService';
import { Container, Typography, TextField, Button, Paper } from '@mui/material';

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
        <Container maxWidth="xs" sx={{ mt: 5 }}>
            <Typography variant="h5" align="center">Check your email</Typography>
            <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 1 }}>
                We sent a 6-digit code to <strong>{email}</strong>
            </Typography>

            <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
                <form onSubmit={handleSubmit}>
                    <TextField
                        label="Verification code"
                        required
                        fullWidth
                        margin="normal"
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
                        color="primary"
                        type="submit"
                        disabled={submitting}
                        sx={{ mt: 3 }}
                    >
                        Verify
                    </Button>
                    <Button fullWidth variant="text" onClick={handleResend} sx={{ mt: 1 }}>
                        Resend code
                    </Button>
                </form>
            </Paper>
        </Container>
    );
};

export default VerifyEmail;
