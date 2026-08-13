import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AppBar,
    Toolbar,
    Button,
    Collapse,
    ClickAwayListener,
    Box,
    Menu,
    MenuItem,
} from '@mui/material';
import UserService from '../api/UserService';
import {
    appBarSx,
    topNavButtonSx,
    drawerPanelSx,
    drawerOptionSx,
    menuPaperSx,
} from '../theme/soulslike';

export const Navigation = (props) => {
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerContent, setDrawerContent] = useState([]);
    const [drawerKey, setDrawerKey] = useState(null);
    const [accountAnchor, setAccountAnchor] = useState(null);
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
            toggleDrawer('playerTools', ['Sphere Converter', 'Bastion Facilities']);
            return;
        }

        if (route === 'admin') {
            toggleDrawer('admin', ['Data Tools']);
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
            <AppBar position="fixed" ref={appBarRef} sx={appBarSx}>
                <Toolbar sx={{ gap: 1 }}>
                    <Button onClick={() => handleTopNavClick('dashboard')} sx={topNavButtonSx}>
                        Home
                    </Button>

                    <Button onClick={() => handleTopNavClick('campaignMaterials')} sx={topNavButtonSx}>
                        Campaign Material
                    </Button>

                    <Button onClick={() => handleTopNavClick('join')} sx={topNavButtonSx}>
                        Join
                    </Button>

                    <Button onClick={() => handleTopNavClick('create')} sx={topNavButtonSx}>
                        Create
                    </Button>

                    <Button onClick={() => handleTopNavClick('playerTools')} sx={topNavButtonSx}>
                        Player Tools
                    </Button>

                    {props.user?.SitePersonaName === 'Administrator' && (
                        <Button onClick={() => handleTopNavClick('admin')} sx={topNavButtonSx}>
                            Admin
                        </Button>
                    )}

                    <Button
                        onClick={(e) => setAccountAnchor(e.currentTarget)}
                        sx={topNavButtonSx}
                    >
                        Account
                    </Button>
                    <Menu
                        anchorEl={accountAnchor}
                        open={Boolean(accountAnchor)}
                        onClose={() => setAccountAnchor(null)}
                        slotProps={{ paper: { sx: menuPaperSx } }}
                    >
                        <MenuItem onClick={() => { setAccountAnchor(null); navigate('/change-password'); }}>
                            Change Password
                        </MenuItem>
                        <MenuItem onClick={() => {
                            setAccountAnchor(null);
                            UserService.clearToken();
                            props.setUser?.(null);
                            props.setActiveCampaignId?.(null);
                            setDrawerOpen(false);
                            navigate('/login');
                        }}>
                            Logout
                        </MenuItem>
                    </Menu>
                </Toolbar>

                <Collapse in={drawerOpen} unmountOnExit>
                    <Box sx={drawerPanelSx}>
                        {drawerContent.map((option, index) => {
                            const label = typeof option === 'string' ? option : option.label;
                            const key = typeof option === 'string' ? index : option.id;
                            return (
                                <Button
                                    key={key}
                                    variant="outlined"
                                    onClick={() => handleDrawerOptionClick(option)}
                                    sx={drawerOptionSx}
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
