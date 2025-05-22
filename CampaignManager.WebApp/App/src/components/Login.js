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
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Login
        </Typography>
        <form onSubmit={handleSubmit}>
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
          <Button type="submit" variant="contained" color="primary" fullWidth>
            Login
          </Button>
          <Box sx={{ mt: 2 }}>
                      <Link to="/register">Register {props.user}</Link>
          </Box>
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