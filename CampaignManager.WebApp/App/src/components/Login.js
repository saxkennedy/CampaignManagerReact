import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, TextField, Button, Typography, Box, Alert } from '@mui/material';
import UserService from '../api/UserService';

export const Login = (props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
      try {
              const res = await UserService.GetUser(email, password)
              if (res) {
                  props.setUser(res.id);
                  navigate('/dashboard');
              }
              else {
                  throw new Error("User Not Found");
              }
                
    }
    catch (err) {
      setError('Login failed');
    }
  };

  return (
    <Container maxWidth="md" sx={{ minHeight: '100%', minWidth: '100%',display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', p: 0 }}>
      <Box
        sx={{
          background: '#fff',
          borderRadius: 4,
          boxShadow: 3,
          p: { xs: 3, sm: 6 },
          width: { xs: '100%', sm: 420 },
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700, color: '#1976d2', mb: 2 }}>
          Campaign Manager
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3, color: 'text.secondary' }}>
          Login to your account
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              variant="outlined"
            />
          </Box>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="outlined"
            />
          </Box>
          <Button type="submit" variant="contained" color="primary" fullWidth size="large" sx={{ py: 1.5, fontWeight: 600 }}>
            Login
          </Button>
          {error && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
        </form>
      </Box>
    </Container>
  );
}

export default Login;