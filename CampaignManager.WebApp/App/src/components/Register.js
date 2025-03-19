import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserService from '../api/UserService';
import { Container, Typography, TextField, Button, Paper, Box } from '@mui/material';

export const Register = (props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError('Invalid email format');
      return;
    }
    var userRequest = { Email: email, Password: password, FirstName: firstName, LastName: lastName };
    try {
      const res = await UserService.CreateUser(userRequest);
      if (res) {
        navigate('/login'); // Redirect to login screen after successful registration
      } else {
        throw new Error("User creation failed");
      }
    } catch (err) {
      setError(err.message);
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