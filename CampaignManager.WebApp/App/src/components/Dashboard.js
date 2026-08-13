import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Snackbar, Alert } from '@mui/material';

export const Dashboard = (props) => {
    const [content, setContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const location = useLocation();
    const navigate = useNavigate();

    // Routes that bounce a user here (no access, dead link) pass a message in state.
    const [notice, setNotice] = useState(location.state?.notice || '');

    useEffect(() => {
        if (!location.state?.notice) return;
        setNotice(location.state.notice);
        // Clear it so a refresh or back-navigation doesn't replay the toast.
        navigate(location.pathname, { replace: true, state: null });
    }, [location.state, location.pathname, navigate]);

    const backgroundUrl = `url("/img/DashboardBackground.jpg")`;


    if (props.fetching) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;


    return (
        <>
            <div style={{
                backgroundImage: backgroundUrl,
                backgroundColor: '#0b0a14',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                height: '100vh',
                width: '100vw',
            }}>
                {/* Dark gradient at the top so the title reads cleanly over the art */}
                <div style={{
                    background: 'linear-gradient(180deg, rgba(6,5,12,0.78) 0%, rgba(6,5,12,0.35) 55%, rgba(6,5,12,0) 100%)',
                    paddingTop: '5vh',
                    paddingBottom: '8vh',
                }}>
                    <Typography
                        component="h1"
                        sx={{
                            textAlign: 'center',
                            fontFamily: `'Cinzel', ui-serif, Georgia, serif`,
                            fontWeight: 900,
                            letterSpacing: { xs: '0.04em', md: '0.08em' },
                            lineHeight: 1.1,
                            fontSize: { xs: '2rem', sm: '3rem', md: '4rem', lg: '4.75rem' },
                            px: 2,
                            background: 'linear-gradient(180deg, #fbe7a1 0%, #e8c873 45%, #b8862f 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            textShadow: '0 2px 18px rgba(0,0,0,0.65)',
                            filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.75))',
                        }}
                    >
                        Ender's Campaign Manager
                        <Box
                            component="span"
                            sx={{
                                display: 'block',
                                mt: 1.5,
                                fontFamily: `'Cinzel', ui-serif, Georgia, serif`,
                                fontWeight: 500,
                                letterSpacing: '0.35em',
                                fontSize: { xs: '0.7rem', sm: '0.85rem', md: '1rem' },
                                color: '#cbb994',
                                WebkitTextFillColor: '#cbb994',
                                textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                            }}
                        >
                            ⚜ ALPHA ⚜
                        </Box>
                    </Typography>
                </div>
            </div>

            <Snackbar
                open={!!notice}
                autoHideDuration={6000}
                onClose={() => setNotice('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="warning" variant="filled" onClose={() => setNotice('')}>
                    {notice}
                </Alert>
            </Snackbar>
        </>
    );
}

export default Dashboard;

