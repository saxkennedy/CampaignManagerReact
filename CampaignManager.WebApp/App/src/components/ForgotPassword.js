import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserService from '../api/UserService';
import { Box, TextField, Button, Typography, Alert, Container } from '@mui/material';
import PotionLoader from './utilities/PotionLoader';

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

const cardSx = {
    background: '#FCF5E5',
    borderRadius: 4,
    boxShadow: 3,
    p: { xs: 3, sm: 6 },
    width: { xs: '92%', sm: 420 },
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
};

export const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState('email'); // 'email' | 'sending' | 'code'
    const [error, setError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const navigate = useNavigate();

    const handleSend = async (e) => {
        e.preventDefault();
        setError('');
        setStep('sending');
        try {
            await UserService.ForgotPassword(email);
            setStep('code');
        } catch {
            setStep('email');
            setError('Something went wrong. Please try again.');
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setVerifying(true);
        setError('');
        try {
            await UserService.VerifyResetCode(email, code);
            navigate('/reset-password', { state: { email, code } });
        } catch (err) {
            setError(err.message);
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div style={bgStyle}>
            <Box sx={cardSx}>
                {step === 'sending' ? (
                    <PotionLoader label="Sending reset code…" minHeight={200} />
                ) : step === 'code' ? (
                    <>
                        <Typography variant="h4" fontWeight={700} color="#1976d2" gutterBottom align="center">
                            Check your email
                        </Typography>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                            We sent a 6-digit code to <strong>{email}</strong>
                        </Typography>
                        <form onSubmit={handleVerifyCode} style={{ width: '100%' }}>
                            <TextField
                                label="Reset code"
                                required
                                fullWidth
                                margin="normal"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                inputProps={{ maxLength: 6 }}
                                autoFocus
                            />
                            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
                            <Button
                                fullWidth
                                variant="contained"
                                type="submit"
                                disabled={verifying}
                                size="large"
                                sx={{ mt: 3, py: 1.5, fontWeight: 600 }}
                            >
                                Submit Reset Code
                            </Button>
                        </form>
                        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                            <Link to="/login">Back to login</Link>
                        </Typography>
                    </>
                ) : (
                    <>
                        <Typography variant="h4" fontWeight={700} color="#1976d2" gutterBottom align="center">
                            Forgot your password?
                        </Typography>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                            Enter your email and we'll send you a reset code.
                        </Typography>
                        <form onSubmit={handleSend} style={{ width: '100%' }}>
                            <TextField
                                label="Email"
                                type="email"
                                required
                                fullWidth
                                margin="normal"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoFocus
                            />
                            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
                            <Button
                                fullWidth
                                variant="contained"
                                type="submit"
                                size="large"
                                sx={{ mt: 3, py: 1.5, fontWeight: 600 }}
                            >
                                Send Reset Code
                            </Button>
                        </form>
                        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                            <Link to="/login">Back to login</Link>
                        </Typography>
                    </>
                )}
            </Box>
        </div>
    );
};

export default ForgotPassword;
