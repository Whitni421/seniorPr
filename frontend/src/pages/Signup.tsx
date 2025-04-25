import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Link,
} from '@mui/material';
import axios from 'axios';
import Logo from '../components/Logo';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    garminEmail: '',
    garminPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3001/api/auth/register', {
        garminEmail: formData.garminEmail.trim(),
        garminPassword: formData.garminPassword.trim()
      });
      
      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      // Store the token and user ID
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user_id', response.data.user_id);
      localStorage.setItem('registrationTime', Date.now().toString());
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Registration failed');
      } else {
        setError('An unexpected error occurred');
      }
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          mb: 3 
        }}>
          <Logo size={45} />
          <Typography component="h1" variant="h4" sx={{ 
            background: 'linear-gradient(135deg, #FF4081 0%, #424242 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Her Garmin
          </Typography>
        </Box>
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            backgroundColor: '#FAFAFA',
          }}
        >
          <Typography 
            component="h2" 
            variant="h5" 
            sx={{ 
              color: '#424242',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mb: 2
            }}
          >
            Sign up
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#757575',
              textAlign: 'center',
              mb: 2,
              fontStyle: 'italic',
              backgroundColor: '#f5f5f5',
              padding: '12px',
              borderRadius: '4px',
              width: '100%'
            }}
          >
            Note: You must have an existing Garmin Connect™ account to use this application.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="garminEmail"
              label="Email Address"
              name="garminEmail"
              autoComplete="email"
              autoFocus
              value={formData.garminEmail}
              onChange={handleChange}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: '#FF4081',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#FF4081',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#FF4081',
                },
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="garminPassword"
              label="Password"
              type="password"
              id="garminPassword"
              value={formData.garminPassword}
              onChange={handleChange}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: '#FF4081',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#FF4081',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#FF4081',
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ 
                mt: 3, 
                mb: 2,
                backgroundColor: '#FF4081',
                color: '#FFFFFF',
                fontWeight: '500',
                letterSpacing: '0.5px',
                '&:hover': {
                  backgroundColor: '#F50057',
                },
                '&.Mui-disabled': {
                  backgroundColor: '#BDBDBD',
                },
              }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link
                href="/login"
                variant="body2"
                sx={{
                  color: '#FF4081',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                Already have an account? Sign in
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Signup; 