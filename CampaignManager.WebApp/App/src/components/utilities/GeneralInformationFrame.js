import React from 'react';
import { Box } from '@mui/material';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const GeneralInformationFrame = ({ url }) => {
    const [content, setContent] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            navigate('/login');
        }
        fetch(url)
            .then(response => response.text())
            .then(data => setContent(data))
            .catch(error => console.error('Error fetching content:', error));
    }, [url, navigate, user]);

    return (
        <Box
            sx={{
                width: '100vw',
                height: '96vh',
                backgroundColor: '#f0f0f0',
                borderRadius: '8px',
                overflow: 'auto',
                padding: 2,
            }}
        >
            <iframe
                srcDoc={content}
                title="General Information"
                style={{ width: '100%', height: '100%', border: 'none' }}
            />

        </Box>
    );
};
GeneralInformationFrame.propTypes = {
    url: PropTypes.string.isRequired,
};
export default GeneralInformationFrame;
