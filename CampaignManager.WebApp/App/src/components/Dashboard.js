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
      <Stack spacing={2}>
        {content.map((item) => (
          <Paper key={item.id} sx={{ p: 2, border: 1 }}>
            <Typography variant="h3" component="h3">
              {item.title}
            </Typography>
            <Typography>{item.description}</Typography>
            {item.imageUrl && (
              <img 
                src={item.imageUrl} 
                alt={item.title}
                style={{ maxWidth: '100%', marginTop: '1rem' }}
              />
            )}
          </Paper>
        ))}
      </Stack>
    </Container>
  );
}

export default Dashboard;