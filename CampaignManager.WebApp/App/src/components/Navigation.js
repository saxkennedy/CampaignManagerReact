import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AppBar,
    Toolbar,
    Button,
    Collapse,
    ClickAwayListener,
    Box,
} from '@mui/material';
import UserService from '../api/UserService';

export const Navigation = (props) => {
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerContent, setDrawerContent] = useState([]);
    const [drawerKey, setDrawerKey] = useState(null);
    const appBarRef = useRef(null);

    const campaigns = useMemo(() => {
        const cps = props.user?.CampaignPersonas ?? [];
        const sorted = [...cps].sort((a, b) =>
            (a.CampaignName || '').localeCompare(b.CampaignName || '')
        );
        return sorted.map(cp => ({ id: cp.CampaignId, label: cp.CampaignName }));
    }, [props.user]);

    const openDrawer = (key, content) => {
        setDrawerKey(key);
        setDrawerContent(content);
        setDrawerOpen(true);
    };

    const toggleDrawer = (key, content) => {
        if (drawerOpen && drawerKey === key) setDrawerOpen(false);
        else openDrawer(key, content);
    };

    const handleTopNavClick = (route) => {
        if (route === 'logout') {
            UserService.clearToken();
            props.setUser?.(null);
            props.setActiveCampaignId?.(null);
            setDrawerOpen(false);
            navigate('/login');
            return;
        }

        setDrawerOpen(false);

        if (route === 'dashboard') return navigate('/dashboard');
        if (route === 'join') return navigate('/join');
        if (route === 'create') return navigate('/create');

        if (route === 'campaignMaterials') {
            toggleDrawer('campaignMaterials', campaigns);
            return;
        }

        if (route === 'playerTools') {
            toggleDrawer('playerTools', ['Sphere Converter']);
            return;
        }
    };

    const handleDrawerOptionClick = (option) => {
        setDrawerOpen(false);

        if (drawerKey === 'campaignMaterials') {
            const id = typeof option === 'string' ? null : option.id;
            if (id) {
                props.setOpenCampaignNav?.(true);
                props.setActiveCampaignId?.(id);
                navigate(`/campaigns/${id}`, { state: { campaignId: id } });
            }
            return;
        }

        const label = typeof option === 'string' ? option : option?.label ?? '';
        const normalized = label.toLowerCase().replace(/\s+/g, '');
        navigate('/' + normalized);
    };

    const onClickAway = (event) => {
        if (!appBarRef.current) return;
        if (appBarRef.current.contains(event.target)) return;
        setDrawerOpen(false);
    };

    return (
        <ClickAwayListener onClickAway={onClickAway}>
            <AppBar position="fixed" ref={appBarRef} sx={{ background: '#1976d2' }}>
                <Toolbar sx={{ gap: 1 }}>
                    <Button onClick={() => handleTopNavClick('dashboard')}
                        sx={{ flexGrow: 1, color: 'white', fontWeight: 600, textTransform: 'none' }}>
                        Home
                    </Button>

                    <Button onClick={() => handleTopNavClick('campaignMaterials')}
                        sx={{ flexGrow: 1, color: 'white', fontWeight: 600, textTransform: 'none' }}>
                        Campaign Material
                    </Button>

                    <Button onClick={() => handleTopNavClick('join')}
                        sx={{ flexGrow: 1, color: 'white', fontWeight: 600, textTransform: 'none' }}>
                        Join
                    </Button>

                    {/* ✅ FIXED */}
                    <Button onClick={() => handleTopNavClick('create')}
                        sx={{ flexGrow: 1, color: 'white', fontWeight: 600, textTransform: 'none' }}>
                        Create
                    </Button>

                    <Button onClick={() => handleTopNavClick('playerTools')}
                        sx={{ flexGrow: 1, color: 'white', fontWeight: 600, textTransform: 'none' }}>
                        Player Tools
                    </Button>

                    <Button onClick={() => handleTopNavClick('logout')}
                        sx={{ flexGrow: 1, color: 'white', fontWeight: 600, textTransform: 'none' }}>
                        Logout
                    </Button>
                </Toolbar>

                <Collapse in={drawerOpen} unmountOnExit>
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        p: 2,
                        backgroundColor: '#1565c0',
                        borderTop: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        {drawerContent.map((option, index) => {
                            const label = typeof option === 'string' ? option : option.label;
                            const key = typeof option === 'string' ? index : option.id;
                            return (
                                <Button
                                    key={key}
                                    variant="outlined"
                                    onClick={() => handleDrawerOptionClick(option)}
                                    sx={{
                                        m: 1,
                                        color: 'white',
                                        borderColor: 'white',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        borderRadius: 2,
                                        px: 2.5,
                                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'white' },
                                    }}
                                >
                                    {label}
                                </Button>
                            );
                        })}
                    </Box>
                </Collapse>
            </AppBar>
        </ClickAwayListener>
    );
};

export default Navigation;
