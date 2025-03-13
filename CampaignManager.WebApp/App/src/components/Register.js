import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserService from '../api/UserService';
import { Container, Typography, TextField, Button, Paper, Box } from '@mui/material';

function Register({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    let user = { Email: email, Password: password };
    try {
      await UserService.CreateUser(user);
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 5 }}>
      <Typography variant="h4" align="center">Create an account</Typography>
      <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 1 }}>
        Already have an account?{' '}
        <Link to="/login">Login</Link>
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            placeholder="your@email.com"
            required
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            placeholder="Your password"
            type="password"
            required
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Typography color="error" variant="body2" sx={{ mt: 1 }}>{error}</Typography>}
          <Button fullWidth variant="contained" color="primary" type="submit" sx={{ mt: 3 }}>
            Register
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default Register;