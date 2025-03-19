import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Navigation = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        // Perform logout logic here
        navigate('/login');
    };

    const navigationBarStyle = {
        position: 'fixed',
        top: 0,
        width: '100%',
        backgroundColor: '#333',
        color: 'white',
        textAlign: 'center',
        padding: '10px 0',
        zIndex: 1000
    };

    const ulStyle = {
        listStyleType: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        justifyContent: 'space-around'
    };

    const liStyle = {
        display: 'inline'
    };

    const aStyle = {
        color: 'white',
        textDecoration: 'none'
    };

    const aHoverStyle = {
        textDecoration: 'underline'
    };

    return (
        <div style={navigationBarStyle}>
            <ul style={ulStyle}>
                <li style={liStyle}>Campaign Info 1</li>
                <li style={liStyle}>Campaign Info 2</li>
                <li style={liStyle}>
                    <a 
                        href="#" 
                        onClick={handleLogout} 
                        style={aStyle} 
                        onMouseOver={(e) => e.target.style.textDecoration = aHoverStyle.textDecoration}
                        onMouseOut={(e) => e.target.style.textDecoration = aStyle.textDecoration}
                    >
                        Logout
                    </a>
                </li>
            </ul>
        </div>
    );
};

export default Navigation;