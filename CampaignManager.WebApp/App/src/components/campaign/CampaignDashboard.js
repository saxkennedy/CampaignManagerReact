import React from 'react';
import { List, ListItem, ListItemText, Collapse, Box } from '@mui/material';
import { useParams, useLocation } from 'react-router-dom';
import ContentViewer from '../utilities/ContentViewer';
import CampaignAdmin from './CampaignAdmin';

export const CampaignDashboard = (props) => {
    // NEW: prefer state.campaignId from Navigation; fallback to parent prop or URL param
    const params = useParams();
    const location = useLocation();
    const campaignId =
        location.state?.campaignId ??
        props.activeCampaignId ??
        params.campaignId ?? null;
    const [campaignDetails, setCampaignDetails] = React.useState({});
    const [selectedRoute, setSelectedRoute] = React.useState(null);
    const [selectedTitle, setSelectedTitle] = React.useState('');
    const [adminMode, setAdminMode] = React.useState(false);

    const user = props?.user; // make sure you pass `user` into this page

    const canAdmin =
        !!(user?.isAdmin) ||
        !!user?.CampaignPersonas?.some(
            (cp) =>
                (!campaignId || cp.CampaignId?.toLowerCase() === campaignId?.toLowerCase()) &&
                /dungeon\s*master/i.test(cp.CampaignPersonaName || '')
        );

    const handleClick = (key) => {
        setCampaignDetails((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleNavigate = (route, title = 'Campaign Document') => {
        if (route) {
            setAdminMode(false);
            setSelectedRoute(route);
            setSelectedTitle(title);
        }
    };

    // Single renderer: expands only if a node has children; leaf nodes go straight to viewer
    const renderNode = (item, level = 0) => {
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        const pad = { paddingLeft: level * 16 };

        if (hasChildren) {
            const isOpen = !!campaignDetails[item.displayName];
            return (
                <div key={`${item.displayName}-${level}`}>
                    <ListItem button onClick={() => handleClick(item.displayName)} style={pad}>
                        <ListItemText primary={item.displayName} />
                        {isOpen ? '^' : '>'}
                    </ListItem>
                    <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            {item.children.map((child) => renderNode(child, level + 1))}
                        </List>
                    </Collapse>
                </div>
            );
        }

        // Leaf node
        if (item.contentLink) {
            return (
                <ListItem
                    key={`${item.displayName}-${level}`}
                    button
                    onClick={() => handleNavigate(item.contentLink, item.displayName)}
                    style={pad}
                >
                    <ListItemText primary={item.displayName} />
                </ListItem>
            );
        }

        // Leaf without link — non-interactive
        return (
            <ListItem key={`${item.displayName}-${level}`} style={pad} disabled>
                <ListItemText primary={item.displayName} />
            </ListItem>
        );
    };

    return (
        <Box
            sx={{
                pt: { xs: 7, sm: 8 }, // sit below fixed AppBar
                minHeight: '100vh',
                display: 'flex',
                gap: 2,
                p: { xs: 1, sm: 2 },

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
                {/* Admin button (only for DMs/admins) */}
                {canAdmin && (
                    <ListItem
                        button
                        onClick={() => {
                            setAdminMode(true);
                            setSelectedRoute(null);
                        }}
                        sx={{
                            mb: 1,
                            borderRadius: 1.5,
                            backgroundColor: 'warning.main',
                            color: 'black',
                            fontWeight: 700,
                            '&:hover': { backgroundColor: 'warning.dark', color: 'white' },
                        }}
                    >
                        <ListItemText primary="Campaign Administration" />
                    </ListItem>
                )}

                {realmsBetwixt.map((item) => renderNode(item, 0))}
            </List>

            {/* Right content area */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}>
                {adminMode ? (
                    <CampaignAdmin campaignId={campaignId} user={props.user.Id} />
                ) : selectedRoute ? (
                    <ContentViewer url={selectedRoute} title={selectedTitle} topOffset={0} />
                ) : (
                    <Box sx={{ p: 2, color: 'text.secondary' }}>Select an item to view its content.</Box>
                )}
            </Box>
        </Box>
    );
};

export default CampaignDashboard;

// NOTE: keeping your previous shape, but with `displayName` and `contentLink`
const realmsBetwixt = [
    {
        displayName: 'Campaign Overview',
        children: [
            {
                displayName: 'Character Creation & Campaign Guidelines',
                contentLink:
                    'https://docs.google.com/document/d/1gm70Hj-4UEgEpOwpvgKn40bJxXqZ0YmgZRn6aaXwmqg/edit?usp=sharing',
                accessHierarchyLevel: 10,
            },
            {
                displayName: 'Campaign Details',
                children: [
                    {
                        displayName: 'Campaign Preface',
                        contentLink:
                            'https://docs.google.com/document/d/1sqnSeDC18f9H6f2LjCgnFOjNozdEvzgTzOC2l7lYwbY/edit?usp=sharing',
                        accessHierarchyLevel: 10,
                    },
                    {
                        displayName: 'The State of the Material Plane',
                        contentLink:
                            'https://docs.google.com/document/d/15vBIP0EC3L5J7ssOxenkUS4T58DI8pEH1X-G_487tn0/edit?usp=sharing',
                        accessHierarchyLevel: 10,
                    },
                ],
            },
        ],
    },
    {
        displayName: 'Alternate Magic Systems',
        children: [
            {
                displayName: 'Allomancy',
                children: [
                    {
                        displayName: 'Allomancy Overview',
                        contentLink:
                            'https://docs.google.com/document/d/1-m4_tvKHyg6r4C8vftxiMId9FRbTnLlNs3R4ykiSmp8/edit?usp=sharing',
                        accessHierarchyLevel: 10,
                    },
                    {
                        displayName: 'Allomantic Metal Pricing Guide',
                        contentLink:
                            'https://docs.google.com/spreadsheets/d/10ksMqrjvnhhaDo1OhRJCIJWCBM8b25p5/edit?usp=sharing&ouid=115506903053452023206&rtpof=true&sd=true',
                        accessHierarchyLevel: 10,
                    },
                    {
                        displayName: 'Misting Prestige Classes',
                        children: [
                            {
                                displayName: 'Coinshot',
                                contentLink:
                                    'https://docs.google.com/document/d/13ymEQYQKDi55Kd9UnQqvALLHvbR9Roqob8ZOm9G7vao/edit?usp=sharing',
                                accessHierarchyLevel: 10,
                            },
                            {
                                displayName: 'Tineye',
                                contentLink:
                                    'https://docs.google.com/document/d/1eKtX576z_BiCGP2J60spspoRkz4GHpPKRiIzMtmBZ1g/edit?usp=sharing',
                                accessHierarchyLevel: 10,
                            },
                            {
                                displayName: 'PewterArm/Thug',
                                contentLink:
                                    'https://docs.google.com/document/d/1yO1MXgJpQ0tJ43vAJZ_OVqWqv1XfRZpA0Mz7HsRiWeQ/edit?usp=sharing',
                                accessHierarchyLevel: 10,
                            },
                        ],
                    },
                ],
            },
            {
                displayName: 'Stormlight',
                children: [
                    {
                        displayName: 'Sphere Conversion',
                        contentLink:
                            'https://docs.google.com/document/d/1rOgT16iMQ4FES8Y2QObOcFX9-P6Vd9e24gWJ_QJ4mY4/edit?usp=sharing',
                        accessHierarchyLevel: 10,
                    },
                    {
                        displayName: 'Radiant Prestige Class Core Features',
                        contentLink:
                            'https://docs.google.com/document/d/1i5at77KIEMQgmkqUXa4s6v1r0lbDmgT4mWdYYbjjUio/edit?usp=sharing',
                        accessHierarchyLevel: 10,
                    },
                    {
                        displayName: 'Radiant Prestige Classes',
                        children: [
                            {
                                displayName: 'Windrunner',
                                contentLink:
                                    'https://docs.google.com/document/d/1-l97owhRf_9e6rCD4_tUWXIUglX6T1SKWon09oXhL68/edit?usp=sharing',
                                accessHierarchyLevel: 10,
                            },
                            {
                                displayName: 'Edgedancer',
                                contentLink:
                                    'https://docs.google.com/document/d/1p1XwqE8XSE6_bXXT5Clb_1iQG4O5j1CaZeqBGgH_dd4/edit?usp=sharing',
                                accessHierarchyLevel: 10,
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        displayName: 'Notable Non-Player Characters',
        children: [
            {
                displayName: 'NPCs',
                contentLink:
                    'https://docs.google.com/spreadsheets/d/1ME0RACvCqrratCMMVSmo2Lh_HR39MV5oEWtx816RFtg/edit?usp=sharing',
                accessHierarchyLevel: 10,
            },
            { displayName: 'DM Only - NPCs', contentLink: '', accessHierarchyLevel: 1 },
        ],
    },
    {
        displayName: 'Maps',
        children: [
            { displayName: 'World Map', contentLink: '', accessHierarchyLevel: 10 },
            { displayName: 'DM Only - World Map', contentLink: '', accessHierarchyLevel: 1 },
        ],
    },
    {
        displayName: 'Chapter Summaries & Encounters',
        children: [
            { displayName: 'Chapter 1 Summary', contentLink: '', accessHierarchyLevel: 10 },
            { displayName: 'DM Only - Chapter 1 Summary', contentLink: '', accessHierarchyLevel: 1 },
            { displayName: 'Chapter 2 Summary', contentLink: '', accessHierarchyLevel: 10 },
            { displayName: 'DM Only - Chapter 2 Summary', contentLink: '', accessHierarchyLevel: 1 },
            { displayName: 'Chapter 3 Summary', contentLink: '', accessHierarchyLevel: 10 },
            { displayName: 'DM Only - Chapter 3 Summary', contentLink: '', accessHierarchyLevel: 1 },
        ],
    },
];
