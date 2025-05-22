import { useState, useEffect } from 'react';
import { Container, Typography, Paper, Stack } from '@mui/material';

export const Dashboard = (props) => {
    const [content, setContent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const backgroundUrl = `url("https://lh3.googleusercontent.com/d/1K3a6x-eXhCUV4Bu8t5COS_z1KjRhOP5K")`;

    
    if (props.fetching) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    
    return (
        <>

            <div style={{
            backgroundImage: backgroundUrl, 
            backgroundSize: 'cover', 
            height: '100vh', 
            width: '100vw'
            }}>
                <Typography variant="h1" component="h1" gutterBottom>
                    Campaign Dashboard
                </Typography>
            </div>
        </>
    );
}

export default Dashboard;

