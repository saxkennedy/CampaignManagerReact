import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Container, TextField, Button, Typography, Box, Alert } from '@mui/material';
import UserService from '../api/UserService';

export const Login = (props) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [unverifiedEmail, setUnverifiedEmail] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const justVerified = location.state?.verified === true;
    const justReset = location.state?.passwordReset === true;
    const backgroundUrl = `url("/img/LoginBackground.jpg")`;

    const handleSubmit = async (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (e?.stopPropagation) e.stopPropagation();

        setError('');
        setUnverifiedEmail(null);
        try {
            const res = await UserService.GetUser(email, password);

            if (res) {
                props.setUser(res);
                navigate('/dashboard');
            } else {
                setError('Login failed');
            }
        } catch (err) {
            if (err.unverified) {
                setUnverifiedEmail(err.email || email);
            } else {
                setError(err.message || 'Login failed');
            }
        }
    };

    const handleSignUp = () => {
        navigate('/register');
    };

    const handleGoVerify = () => {
        navigate('/verify', { state: { email: unverifiedEmail } });
    };

    return (
        <div
            style={{
                backgroundImage: backgroundUrl,
                backgroundSize: 'cover',
                height: '100vh',
                width: '100vw',
            }}
        >
            <Container
                maxWidth="md"
                sx={{
                    minHeight: '100%',
                    minWidth: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 0,
                }}
            >
                <Box
                    sx={{
                        background: '#FCF5E5',
                        borderRadius: 4,
                        boxShadow: 3,
                        p: { xs: 3, sm: 6 },
                        width: { xs: '100%', sm: 420 },
                        mx: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Typography
                        variant="h3"
                        component="h1"
                        gutterBottom
                        sx={{
                            fontWeight: 700,
                            color: '#1976d2',
                            mb: 2,
                            textAlign: 'center',
                        }}
                    >
                        Ender's Campaign Manager (ALPHA)
                    </Typography>

                    <Typography
                        variant="h5"
                        component="h2"
                        gutterBottom
                        sx={{ mb: 3, color: 'text.secondary' }}
                    >
                        Login to your account
                    </Typography>

                    {justVerified && (
                        <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                            Email verified! You can now log in.
                        </Alert>
                    )}

                    {justReset && (
                        <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                            Password reset successfully. You can now log in.
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} style={{ width: '100%' }} autoComplete="off">
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                variant="outlined"
                                autoComplete="username"
                            />
                        </Box>
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                variant="outlined"
                                autoComplete="current-password"
                            />
                        </Box>

                        <Typography variant="body2" align="right" sx={{ mb: 1 }}>
                            <Link to="/forgot-password">Forgot password?</Link>
                        </Typography>

                        <Button
                            type="submit"
                            onClick={handleSubmit}
                            variant="contained"
                            color="primary"
                            fullWidth
                            size="large"
                            sx={{ py: 1.5, fontWeight: 600 }}
                        >
                            Login
                        </Button>

                        {error && (
                            <Box sx={{ mt: 2 }}>
                                <Alert severity="error">{error}</Alert>
                            </Box>
                        )}

                        {unverifiedEmail && (
                            <Box sx={{ mt: 2 }}>
                                <Alert
                                    severity="warning"
                                    action={
                                        <Button color="inherit" size="small" onClick={handleGoVerify}>
                                            Verify now
                                        </Button>
                                    }
                                >
                                    Email not verified.
                                </Alert>
                            </Box>
                        )}
                    </form>

                    <Button
                        onClick={handleSignUp}
                        variant="outlined"
                        color="secondary"
                        fullWidth
                        size="large"
                        sx={{ mt: 2, py: 1.5, fontWeight: 600 }}
                    >
                        Sign Up
                    </Button>
                </Box>
            </Container>
        </div>
    );
};

export default Login;
