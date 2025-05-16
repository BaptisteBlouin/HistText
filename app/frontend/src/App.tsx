import { useApolloClient } from '@apollo/client';
import { GraphQLPage } from './containers/GraphQLPage';
import { useAuth, useAuthCheck } from './hooks/useAuth';
import { AccountPage } from './containers/AccountPage';
import { LoginPage } from './containers/LoginPage';
import { OauthLoginResultPage } from './containers/OauthLoginResultPage';
import { ActivationPage } from './containers/ActivationPage';
import { RegistrationPage } from './containers/RegistrationPage';
import { RecoveryPage } from './containers/RecoveryPage';
import { ResetPage } from './containers/ResetPage';
import React from 'react';
import './App.css';
import { Home } from './containers/Home';
import { Todos } from './containers/Todo';
import { Files } from './containers/Files';
import { Route, useNavigate, Routes } from 'react-router-dom';
import HistText from './containers/HistText';
import AdminPanel from './containers/admin/AdminPanel';

import HistLogo from './images/HistTextLogoC.png';

const App = () => {
  useAuthCheck();
  const auth = useAuth();

  const navigate = useNavigate();
  /* CRA: app hooks */
  const apollo = useApolloClient();
  //{ !auth.isAuthenticated && <a className="NavButton" onClick={() => navigate('/login')}>Login/Register</a> }
  // @ts-ignore
  return (
    <div className="App">
      <div className="App-nav-header">
        <div style={{ display: 'flex', flex: 1 }}>
          <a className="NavButton" onClick={() => navigate('/histtext')}>
            <img src={HistLogo} alt="react-logo" style={{ height: '95%' }} />
          </a>
        </div>
        <div style={{ display: 'flex' }}>
          <a className="NavButton" onClick={() => navigate('/')}>
            Home
          </a>
          {/* CRA: left-aligned nav buttons */}
          {auth.isAuthenticated && (
            <a className="NavButton" onClick={() => navigate('/account')}>
              Account
            </a>
          )}
          {!auth.isAuthenticated && (
            <a className="NavButton" onClick={() => navigate('/login')}>
              Login
            </a>
          )}

          {auth.session?.hasRole('Admin') && (
            <a className="NavButton" onClick={() => navigate('/Admin')}>
              Admin
            </a>
          )}
          {/* CRA: right-aligned nav buttons */}
          {auth.isAuthenticated && (
            <a
              className="NavButton"
              onClick={() => {
                auth.logout();
                apollo.resetStore();
              }}
            >
              Logout
            </a>
          )}
        </div>
      </div>
      <div style={{ margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/todos" element={<Todos />} />
          {/* CRA: routes */}
          <Route path="/gql" element={<GraphQLPage />} />
          <Route path="/files" element={<Files />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth/success" element={<OauthLoginResultPage />} />
          <Route path="/oauth/error" element={<OauthLoginResultPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="/activate" element={<ActivationPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/histtext" element={<HistText />} />
          <Route path="/Admin" element={<AdminPanel />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
