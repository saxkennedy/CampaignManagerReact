import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserService from '../api/UserService';
import { Box, Typography, TextField, Button } from '@mui/material';
import {
    authBgStyle,
    authCardSx,
    authTitleSx,
    authBodySx,
    authLinkStyle,
    darkFieldSx,
    goldButtonSx,
} from '../theme/soulslike';

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
      await UserService.CreateUser(userRequest);
      navigate('/verify', { state: { email } });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={authBgStyle}>
      <Box sx={{ ...authCardSx, width: { xs: '92%', sm: 440 } }}>
        <Typography variant="h4" gutterBottom sx={authTitleSx}>Create an account</Typography>
        <Typography variant="body2" sx={authBodySx}>
          Already have an account?{' '}
          <Link to="/login" style={authLinkStyle}>Login</Link>
        </Typography>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <TextField
            label="Email"
            placeholder="your@email.com"
            required
            fullWidth
            margin="normal"
            sx={darkFieldSx}
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
            sx={darkFieldSx}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Typography color="error" variant="body2" sx={{ mt: 1 }}>{error}</Typography>}
          <Button fullWidth variant="contained" type="submit" sx={{ ...goldButtonSx, mt: 3, py: 1.5 }}>
            Register
          </Button>
        </form>
      </Box>
    </div>
  );
}

export default Register;