import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Collapse, Button, List, ListItem } from '@mui/material';


export const Navigation = (props) => {
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerContent, setDrawerContent] = useState("campaignMaterials");

    const handleNavigate = (route) => {
        setDrawerOpen(false);
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
            props.setCampaignDetails(campaignDetails);
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

const campaignDetails = [
    {
        name: 'Campaign Overview',
        children: [
            { name: 'Character Creation & Guidelines', route: '', access: 'Public' },
            { name: 'Campaign Details', route: 'https://docs.google.com/document/d/15vBIP0EC3L5J7ssOxenkUS4T58DI8pEH1X-G_487tn0/edit?usp=sharing', access: 'Public' },
            { name: 'DM Only - Campaign Details', route: '', access: 'Private' },
        ],
    },
    {
        name: 'Alternate Magic Systems',
        children: [
            {
                name: 'Allomancy',
                children: [
                    { name: 'Allomancy Overview', route: '', access: 'Public' },
                    { name: 'DM Only - Allomancy Snap Chart', route: '', access: 'Private' },
                    { name: 'Coinshot', route: '', access: 'Public' },
                    { name: 'Mistborn', route: '', access: 'Public' }
                ]
            },
            {
                name: 'Stormlight',
                children: [
                    { name: 'Stormlight Overview', route: '', access: 'Public' },
                    { name: 'Sphere Conversion', route: '', access: 'Public' },
                    { name: 'Windrunner', route: '', access: 'Public' },
                    { name: 'Edgedancer', route: '', access: 'Private' }
                ]
            }
        ],
    },
    {
        name: 'Notable Non-Player Characters',
        children: [
            { name: 'NPCs', route: '', access: 'Public' },
            { name: 'DM Only - NPCs', route: '', access: 'Private' },
        ],
    },
    {
        name: 'Maps',
        children: [
            { name: 'World Map', route: '', access: 'Public' },
            { name: 'DM Only - World Map', route: '', access: 'Private' }
        ],
        name: 'Chapter Summaries & Encounters',
        children: [
            { name: 'Chapter 1 Summary', route: '', access: 'Public' },
            { name: 'DM Only - Chapter 1 Summary', route: '', access: 'Private' },
            { name: 'Chapter 2 Summary', route: '', access: 'Public' },
            { name: 'DM Only - Chapter 2 Summary', route: '', access: 'Private' },
            { name: 'Chapter 3 Summary', route: '', access: 'Public' },
            { name: 'DM Only - Chapter 3 Summary', route: '', access: 'Private' }
        ],
    },
];