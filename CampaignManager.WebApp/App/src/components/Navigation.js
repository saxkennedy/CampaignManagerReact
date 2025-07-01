import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Collapse, Button, List, ListItem } from '@mui/material';


export const Navigation = (props) => {
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerContent, setDrawerContent] = useState([]);

    const handleNavigate = (route) => {
        setDrawerOpen(false);
        props.setOpenCampaignNav(false);
        var navRoute = "/" + route;
        if (route === "login") {
            props.setUser(null);
        }
        if (route === "campaignMaterials") {
            setDrawerContent(["Realms Betwixt", "Coming Soon", "Coming Soon"]);
            setDrawerOpen(!drawerOpen);
        }
        if (route === "playerTools") {
            setDrawerContent(["Sphere Converter", "Coming Soon", "Coming Soon"]);
            setDrawerOpen(!drawerOpen);
        }
        else if (route === "realmsbetwixt") {
            props.setOpenCampaignNav(true);
        }
        else if (route === "sphereConverter") {
            props.setOpenTool("sphereConverter");
        }
        navigate(navRoute);
    };


    return (
        <>
            <AppBar position="fixed">
                <Toolbar>
                    <Button color="" onClick={() => handleNavigate("dashboard")} sx={{ flexGrow: 1 }}>
                        Home
                    </Button>
                    <Button color="inherit" onClick={() => handleNavigate("campaignMaterials")} sx={{ flexGrow: 1 }}>
                        Campaign Material
                    </Button>
                    <Button color="inherit" onClick={() => handleNavigate("playerTools")} sx={{ flexGrow: 1 }}>
                        Player Tools
                    </Button>
                    <Button color="inherit" onClick={() => handleNavigate("login")} sx={{ flexGrow: 1 }}>
                        Logout
                    </Button>
                </Toolbar>
                <Collapse in={drawerOpen}>
                    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {drawerContent.map((option, index) => (
                            <Button 
                                key={index} 
                                variant="contained" 
                                onClick={() => handleNavigate(option.toLowerCase().replace(" ", ""))} 
                                sx={{ margin: '8px' }}
                            >
                                {option}
                            </Button>
                        ))}
                    </div>
                </Collapse>                  
            </AppBar>
            
        </>
    );
};

export default Navigation;

