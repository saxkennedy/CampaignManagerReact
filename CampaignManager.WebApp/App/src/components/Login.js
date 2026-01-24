import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, TextField, Button, Typography, Box, Alert } from '@mui/material';
import UserService from '../api/UserService';

export const Login = (props) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const backgroundUrl = `url("https://lh3.googleusercontent.com/d/1_gpQmsPAeoSiolDu-NUdOWxDlbkdkPP3")`;

    const handleSubmit = async (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (e?.stopPropagation) e.stopPropagation();

        setError('');
        try {
            const res = await UserService.GetUser(email, password);

            if (res) {
                props.setUser(res);
                navigate('/dashboard');
            } else {
                setError('Login failed');
            }
        } catch (err) {
            setError('Login failed');
        }
    };

    const handleSignUp = () => {
        navigate('/register');
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

                        <Button
                            type="submit"
                            onClick={handleSubmit}  // ✅ ensures click triggers even if form submit wiring breaks
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
