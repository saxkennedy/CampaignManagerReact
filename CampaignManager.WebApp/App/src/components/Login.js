import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Container, TextField, Button, Typography, Box, Alert } from '@mui/material';
import UserService from '../api/UserService';
import { isCampaignMember, NO_ACCESS_NOTICE } from './campaign/campaignPermissions';
import {
    authCardSx,
    authTitleSx,
    authSubtitleSx,
    darkFieldSx,
    goldButtonSx,
    soulslike,
} from '../theme/soulslike';

// Where to land after signing in. Honours the path a shared link was headed for,
// but only for in-app paths the freshly-signed-in user can actually reach.
const destinationFor = (user, returnTo) => {
    const isInAppPath =
        typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//');
    if (!isInAppPath || returnTo === '/login') return { path: '/dashboard' };

    const campaign = returnTo.match(/^\/campaigns\/([^/?#]+)/i);
    if (campaign && !isCampaignMember(user, campaign[1])) {
        return { path: '/dashboard', state: { notice: NO_ACCESS_NOTICE } };
    }

    return { path: returnTo };
};

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
                const { path, state } = destinationFor(res, location.state?.returnTo);
                navigate(path, { replace: true, state });
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
                <Box sx={authCardSx}>
                    <Typography variant="h3" component="h1" gutterBottom sx={authTitleSx}>
                        Ender's Campaign Manager
                    </Typography>

                    <Typography component="div" sx={{ ...authSubtitleSx, mt: -1, mb: 2.5 }}>
                        ⚜ Alpha ⚜
                    </Typography>

                    <Typography variant="h6" component="h2" gutterBottom sx={authSubtitleSx}>
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
                                sx={darkFieldSx}
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
                                sx={darkFieldSx}
                                autoComplete="current-password"
                            />
                        </Box>

                        <Typography variant="body2" align="right" sx={{ mb: 1 }}>
                            <Link
                                to="/forgot-password"
                                style={{ color: soulslike.parchment, textDecorationColor: soulslike.edge }}
                            >
                                Forgot password?
                            </Link>
                        </Typography>

                        <Button
                            type="submit"
                            onClick={handleSubmit}
                            variant="contained"
                            fullWidth
                            size="large"
                            sx={{ ...goldButtonSx, py: 1.5 }}
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
                        fullWidth
                        size="large"
                        sx={{
                            mt: 2,
                            py: 1.5,
                            color: soulslike.goldBright,
                            borderColor: soulslike.edge,
                            fontFamily: `'Cinzel', ui-serif, Georgia, serif`,
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            '&:hover': {
                                borderColor: soulslike.gold,
                                backgroundColor: 'rgba(200,164,77,0.12)',
                            },
                        }}
                    >
                        Sign Up
                    </Button>
                </Box>
            </Container>
        </div>
    );
};

export default Login;
