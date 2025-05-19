import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const LoginPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setProcessing(true);
    setError(null); // Reset any previous errors
    try {
      await auth.login(email, password);
      if (!auth.isAuthenticated) {
        // If authentication still fails after the login attempt
        setError('Invalid credentials. Please try again.');
      } else {
        // Redirect if login is successful
        navigate('/');
      }
    } catch (err) {
      // Catch any exceptions (e.g., network issues or explicit error throw)
      setError('Invalid credentials. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (auth.isAuthenticated) {
    navigate('/');
    return <div>Already logged in. Redirecting you to the home page...</div>;
  }

  return (
    <div className="Form" style={{ textAlign: 'left' }}>
      <br />
      <div style={{ display: 'flex', flexFlow: 'column', width: '33%' }}>
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexFlow: 'column', width: '33%' }}>
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexFlow: 'column' }}>
        <button disabled={processing} onClick={login}>
          Login
        </button>
      </div>

      {/* Display error message if exists */}
      {error && <div style={{ color: 'red', marginTop: '20px' }}>{error}</div>}

      <a style={{ marginTop: '30px' }} href="#" onClick={() => navigate('/register')}>
        Don't have an account? Click here to register.
      </a>
      <a style={{ marginTop: '30px' }} href="#" onClick={() => navigate('/recovery')}>
        Forgot your password? Click here to recover your account.
      </a>
    </div>
  );
};
