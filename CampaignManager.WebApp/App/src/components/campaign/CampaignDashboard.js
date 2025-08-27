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
            { name: 'Character Creation & Campaign Guidelines', route: 'https://docs.google.com/document/d/1gm70Hj-4UEgEpOwpvgKn40bJxXqZ0YmgZRn6aaXwmqg/edit?usp=sharing', access: 'Public' },
            {
                name: 'Campaign Details',
                children: [
                    { name: 'Campaign Preface', route: 'https://docs.google.com/document/d/1sqnSeDC18f9H6f2LjCgnFOjNozdEvzgTzOC2l7lYwbY/edit?usp=sharing', access: 'Public' },
                    { name: 'The State of the Material Plane', route: 'https://docs.google.com/document/d/15vBIP0EC3L5J7ssOxenkUS4T58DI8pEH1X-G_487tn0/edit?usp=sharing', access: 'Public' }
                ]
            }
        ]
    },
    {
        name: 'Alternate Magic Systems',
        children: [
            {
                name: 'Allomancy',
                children: [
                    { name: 'Allomancy Overview', route: 'https://docs.google.com/document/d/1-m4_tvKHyg6r4C8vftxiMId9FRbTnLlNs3R4ykiSmp8/edit?usp=sharing', access: 'Public' },
                    { name: 'Allomantic Metal Pricing Guide', route: 'https://docs.google.com/spreadsheets/d/10ksMqrjvnhhaDo1OhRJCIJWCBM8b25p5/edit?usp=sharing&ouid=115506903053452023206&rtpof=true&sd=true', access: 'Public'},
                    //{ name: 'DM Only - Allomancy Snap Chart', route: '', access: 'Private' },
                    {
                        name: 'Misting Prestige Classes',
                        children: [
                            { name: 'Coinshot', route: 'https://docs.google.com/document/d/13ymEQYQKDi55Kd9UnQqvALLHvbR9Roqob8ZOm9G7vao/edit?usp=sharing', access: 'Public' },
                            { name: 'Tineye', route: 'https://docs.google.com/document/d/1eKtX576z_BiCGP2J60spspoRkz4GHpPKRiIzMtmBZ1g/edit?usp=sharing', access: 'Public' },
                            { name: 'PewterArm/Thug', route: 'https://docs.google.com/document/d/1yO1MXgJpQ0tJ43vAJZ_OVqWqv1XfRZpA0Mz7HsRiWeQ/edit?usp=sharing', access: 'Public' }
                        ]
                    }                    
                ],
            },
            {
                name: 'Stormlight',
                children: [                    
                    { name: 'Sphere Conversion', route: 'https://docs.google.com/document/d/1rOgT16iMQ4FES8Y2QObOcFX9-P6Vd9e24gWJ_QJ4mY4/edit?usp=sharing', access: 'Public' },
                    { name: 'Radiant Prestige Class Core Features', route: 'https://docs.google.com/document/d/1i5at77KIEMQgmkqUXa4s6v1r0lbDmgT4mWdYYbjjUio/edit?usp=sharing', access: 'Public' },
                    {
                        name: 'Radiant Prestige Classes',
                        children: [
                            { name: 'Windrunner', route: 'https://docs.google.com/document/d/1-l97owhRf_9e6rCD4_tUWXIUglX6T1SKWon09oXhL68/edit?usp=sharing', access: 'Public' },
                            { name: 'Edgedancer', route: 'https://docs.google.com/document/d/1p1XwqE8XSE6_bXXT5Clb_1iQG4O5j1CaZeqBGgH_dd4/edit?usp=sharing', access: 'Public' }
                        ]
                    }
                    
                ],
            },
        ],
    },
    {
        name: 'Notable Non-Player Characters',
        children: [
            { name: 'NPCs', route: 'https://docs.google.com/spreadsheets/d/1ME0RACvCqrratCMMVSmo2Lh_HR39MV5oEWtx816RFtg/edit?usp=sharing', access: 'Public' },
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
