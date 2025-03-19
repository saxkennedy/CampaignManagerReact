import { useState, useEffect } from 'react';
import { Container, Typography, Paper, Stack } from '@mui/material';

export const Dashboard = (props) => {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  if (props.fetching) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h1" component="h1" gutterBottom>
        Campaign Dashboard
      </Typography>
    </Container>
  );
}

export default Dashboard;