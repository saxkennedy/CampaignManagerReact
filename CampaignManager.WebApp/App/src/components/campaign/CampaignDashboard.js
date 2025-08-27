import React from 'react';
import { List, ListItem, ListItemText, Collapse, Box } from '@mui/material';
import ContentViewer from '../utilities/ContentViewer';

export const CampaignDashboard = () => {
    const [campaignDetails, setCampaignDetails] = React.useState({});
    const [selectedRoute, setSelectedRoute] = React.useState(null);
    const [selectedTitle, setSelectedTitle] = React.useState('');

    const handleClick = (item) => {
        setCampaignDetails((prev) => ({ ...prev, [item]: !prev[item] }));
    };

    const handleNavigate = (route, title='Campaign Document') => {
        if (route) {
            setSelectedRoute(route);
            setSelectedTitle(title);
        }
    };

    const renderChildren = (children, level = 1) =>
        children.map((child) => (
            <div key={child.name} style={{ paddingLeft: level * 16 }}>
                <ListItem button onClick={() => handleClick(child.name)}>
                    <ListItemText primary={child.name} />
                    {campaignDetails[child.name] ? '^' : '>'}
                </ListItem>
                <Collapse in={campaignDetails[child.name]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {child.children?.length ? renderChildren(child.children, level + 1) : null}
                        {child.route && (
                            <ListItem
                                button
                                onClick={() => handleNavigate(child.route, child.name)}
                                style={{ paddingLeft: (level + 1) * 16 }}
                            >
                                <ListItemText primary={child.name} />
                            </ListItem>
                        )}
                    </List>
                </Collapse>
            </div>
        ));

    return (
        <Box
            sx={{
                // keep content below fixed AppBar from Navigation.js
                pt: { xs: 7, sm: 8 },
                minHeight: '100vh',
                display: 'flex',
                gap: 2,
                p: { xs: 1, sm: 2 },
                // parchment vibe background
                backgroundColor: '#F6F0E1',
                backgroundImage:
                    'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.025) 1px, transparent 1px)',
                backgroundSize: '8px 8px, 16px 16px',
                backgroundPosition: '0 0, 4px 4px',
                boxSizing: 'border-box',
            }}
        >
            {/* Left sidenav */}
            <List
                component="nav"
                sx={{
                    width: 'fit-content',
                    minWidth: 240,
                    maxWidth: 400,
                    bgcolor: 'transparent',
                    boxSizing: 'border-box',
                }}
            >
                {realmsBetwixt.map((item) => (
                    <div key={item.name}>
                        <ListItem button onClick={() => handleClick(item.name)}>
                            <ListItemText primary={item.name} />
                            {campaignDetails[item.name] ? '^' : '>'}
                        </ListItem>
                        <Collapse in={campaignDetails[item.name]} timeout="auto" unmountOnExit>
                            <List component="div" disablePadding>
                                {renderChildren(item.children)}
                            </List>
                        </Collapse>
                    </div>
                ))}
            </List>

            {/* Right content viewer fills remaining space */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}>
                {selectedRoute ? (
                    // parent container already has top padding, so set topOffset={0}
                    <ContentViewer url={selectedRoute} title={selectedTitle}  topOffset={0} />
                ) : (
                    <Box sx={{ p: 2, color: 'text.secondary' }}>
                        Select an item to view its content.
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default CampaignDashboard;

// Your data (kept the Google Doc route you provided)
const realmsBetwixt = [
    {
        name: 'Campaign Overview',
        children: [
            { name: 'Character Creation & Guidelines', route: '', access: 'Public' },
            {
                name: 'Campaign Details',
                route:
                    'https://docs.google.com/document/d/15vBIP0EC3L5J7ssOxenkUS4T58DI8pEH1X-G_487tn0/edit?usp=sharing',
                access: 'Public',
            },
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
                    { name: 'Mistborn', route: '', access: 'Public' },
                ],
            },
            {
                name: 'Stormlight',
                children: [
                    { name: 'Stormlight Overview', route: '', access: 'Public' },
                    { name: 'Sphere Conversion', route: '', access: 'Public' },
                    { name: 'Windrunner', route: '', access: 'Public' },
                    { name: 'Edgedancer', route: '', access: 'Private' },
                ],
            },
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
            { name: 'DM Only - World Map', route: '', access: 'Private' },
        ],
    },
    {
        name: 'Chapter Summaries & Encounters',
        children: [
            { name: 'Chapter 1 Summary', route: '', access: 'Public' },
            { name: 'DM Only - Chapter 1 Summary', route: '', access: 'Private' },
            { name: 'Chapter 2 Summary', route: '', access: 'Public' },
            { name: 'DM Only - Chapter 2 Summary', route: '', access: 'Private' },
            { name: 'Chapter 3 Summary', route: '', access: 'Public' },
            { name: 'DM Only - Chapter 3 Summary', route: '', access: 'Private' },
        ],
    },
];
