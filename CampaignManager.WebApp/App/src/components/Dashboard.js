import { useState, useEffect } from 'react';
import { Container, Title, Text, Paper, Stack } from '@mantine/core';

function Dashboard({ user }) {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    //const fetchContent = async () => {
    //  try {
    //    const response = await campaign.getContent();
    //    setContent(response.data);
    //  } catch (err) {
    //    setError('Failed to load campaign content');
    //  } finally {
    //    setLoading(false);
    //  }
    //};
    //
    //fetchContent();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="xl">Campaign Dashboard</Title>
      <Stack spacing="md">
        {content.map((item) => (
          <Paper key={item.id} p="md" withBorder>
            <Title order={3}>{item.title}</Title>
            <Text>{item.description}</Text>
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