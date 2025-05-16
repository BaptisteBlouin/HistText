import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './css/AccountPage.css';
import { ChangePasswordForm } from './components/ChangePasswordForm';
import { SessionsList } from './components/SessionsList';
import { UserDetails } from './components/UserDetails';
import { Permissions } from './components/Permissions';
import { UserToken } from './components/Token';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Box, Grid, Typography, Button } from '@mui/material';

export const AccountPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  return (
    <Box className="account-page" sx={{ textAlign: 'left', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Account
      </Typography>
      {auth.isAuthenticated ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <UserDetails auth={auth} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Permissions auth={auth} />
          </Grid>
          <Grid item xs={12} md={6}>
            <UserToken auth={auth} />
          </Grid>
          <Grid item xs={12} md={6}>
            <ChangePasswordForm auth={auth} />
          </Grid>
        </Grid>
      ) : (
        <Box>
          <Button variant="contained" color="primary" onClick={() => navigate('/login')}>
            Login to view your account details
          </Button>
        </Box>
      )}
      <ToastContainer />
    </Box>
  );
};
/**
 *<Grid item xs={12}>
 *  <SessionsList auth={auth} />
 *</Grid>
 */
