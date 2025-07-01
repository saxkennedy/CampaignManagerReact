import React from 'react';
import { List, ListItem, ListItemText, Collapse } from '@mui/material';
import GeneralInformationFrame from '../utilities/GeneralInformationFrame'; 

export const CampaignSideNav = () => {
    const [campaignDetails, setCampaignDetails] = React.useState({});
    const expandLessIcon = <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=keyboard_arrow_up" />
    const expandMoreIcon = <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=keyboard_arrow_down" />

    const handleClick = (item) => {
        setCampaignDetails((prev) => ({
            ...prev,
            [item]: !prev[item],
        }));
    };

    const handleNavigate = (route) => {
        return (
            <GeneralInformationFrame url={route} />
        );
    };

    const renderChildren = (children, level = 1) => {
        return children.map((child) => (
            <div key={child.name} style={{ paddingLeft: level * 16 }}>
                <ListItem button onClick={() => handleClick(child.name)}>
                    <ListItemText primary={child.name} />
                    {campaignDetails[child.name] ? "^" : ">"}
                </ListItem>
                <Collapse in={campaignDetails[child.name]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {child.children && child.children.length > 0 ? renderChildren(child.children, level + 1) : null}
                        {child.route && (
                            <ListItem button onClick={() => handleNavigate(child.route)} style={{ paddingLeft: (level + 1) * 16 }}>
                                <ListItemText primary={child.name} />
                            </ListItem>
                        )}
                    </List>
                </Collapse>
            </div>
        ));
    };

    return (
        <List
            component="nav"
            sx={{
                width: 'fit-content',
                minWidth: 240,
                maxWidth: 400,
                bgcolor: 'background.paper',
                boxSizing: 'border-box',
            }}
        >
            {realmsBetwixt.map((item) => (
                <div key={item.name}>
                    <ListItem button onClick={() => handleClick(item.name)}>
                        <ListItemText primary={item.name} />
                        {campaignDetails[item.name] ? "^" : ">" }
                    </ListItem>
                    <Collapse in={campaignDetails[item.name]} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            {renderChildren(item.children)}
                        </List>
                    </Collapse>
                </div>
            ))}
        </List>
    );
};

export default CampaignSideNav;

const realmsBetwixt = [
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
    }
];