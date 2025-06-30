import React from 'react';
import { List, ListItem, ListItemText, Collapse } from '@mui/material';
import PropTypes from 'prop-types';
import GeneralInformationFrame from './GeneralInformationFrame'; 

export const CampaignSideNav = ({ categories }) => {
    const [openCategories, setOpenCategories] = React.useState({});
    const expandLessIcon = <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=keyboard_arrow_up" />
    const expandMoreIcon = <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=keyboard_arrow_down" />

    const handleClick = (category) => {
        setOpenCategories((prev) => ({
            ...prev,
            [category]: !prev[category],
        }));
    };

    const handleNavigate = (route) => {
        return (
            <GeneralInformationFrame url={route} />
        );
    };

    const renderChildren = (children) => {
        return children.map((child) => (
            <div key={child.name}>
                <ListItem button onClick={() => handleClick(child.name)}>
                    <ListItemText primary={child.name} />
                    {openCategories[child.name] ? <style>
                        .material-symbols-outlined {
                            font - variation - settings:
                        'FILL' 0,
                        'wght' 400,
                        'GRAD' 0,
                        'opsz' 24
}
                    </style> : <ExpandMoreIcon />}
                </ListItem>
                <Collapse in={openCategories[child.name]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {child.children && child.children.length > 0 ? renderChildren(child.children) : null}
                        {child.route && (
                            <ListItem button onClick={() => handleNavigate(child.route)}>
                                <ListItemText primary={child.name} />
                            </ListItem>
                        )}
                    </List>
                </Collapse>
            </div>
        ));
    };

    return (
        <List component="nav">
            {categories.map((category) => (
                <div key={category.name}>
                    <ListItem button onClick={() => handleClick(category.name)}>
                        <ListItemText primary={category.name} />
                        {openCategories[category.name] ? expandLessIcon : expandMoreIcon }
                    </ListItem>
                    <Collapse in={openCategories[category.name]} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            {renderChildren(category.children)}
                        </List>
                    </Collapse>
                </div>
            ))}
        </List>
    );
};

CampaignSideNav.propTypes = {
    categories: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            children: PropTypes.arrayOf(
                PropTypes.shape({
                    name: PropTypes.string.isRequired,
                    route: PropTypes.string,
                    children: PropTypes.array,
                })
            ).isRequired,
        })
    ).isRequired,
};

export default CampaignSideNav;