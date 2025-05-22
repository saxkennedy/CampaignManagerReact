import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';

export const Navigation = (props) => {
    const navigate = useNavigate();

    const handleNavigate = (route) => {
        var navRoute = "/" + route;
        if (route == "login") {
            props.setUser(null);
        }
        navigate(navRoute);
    };

    return (
        <AppBar position="fixed">
            <Toolbar>
                <Button color="inherit" onClick={() => handleNavigate("dashboard")} sx={{ flexGrow: 1 }}>
                    Home
                </Button>
                <Button color="inherit" onClick={() => handleNavigate("campaignMaterial")} sx={{ flexGrow: 1 }}>
                    Campaign Material
                </Button>
                <Button color="inherit" onClick={() => handleNavigate("characterRoller")} sx={{ flexGrow: 1 }}>
                    Character Roller
                </Button>
                <Button color="inherit" onClick={() => handleNavigate("login")} sx={{ flexGrow: 1 }}>
                    Logout
                </Button>
            </Toolbar>
        </AppBar>
    );
};


export default Navigation;