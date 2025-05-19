import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const RegistrationPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [firstname, setFirstname] = useState<string>('');
  const [lastname, setLastname] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Helper function to validate an email address
  const validateEmail = (email: string): boolean => {
    // Basic regex for email validation
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return re.test(String(email).toLowerCase());
  };

  // Helper function to validate password strength
  // Here we require at least 8 characters, one uppercase, one lowercase, one digit, and one special character.
  const validatePassword = (password: string): boolean => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{8,}$/;
    return re.test(password);
  };

  const register = async () => {
    // Reset errors on each attempt
    setErrors([]);

    // Validate inputs
    const validationErrors: string[] = [];
    if (!firstname.trim()) {
      validationErrors.push('First name cannot be empty.');
    }
    if (!lastname.trim()) {
      validationErrors.push('Last name cannot be empty.');
    }
    if (!validateEmail(email)) {
      validationErrors.push('Please enter a valid email address.');
    }
    if (!validatePassword(password)) {
      validationErrors.push(
        'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character.',
      );
    }

    // If there are errors, display them and do not proceed
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          firstname,
          lastname,
          activated: false, // assuming activation is handled separately
        }),
      });

      const data = await response.json();
      console.log(data);
      navigate('/activate');
    } catch (error) {
      console.error('Registration failed', error);
      setErrors(['Registration failed. Please try again later.']);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="Form" style={{ textAlign: 'left' }}>
      <h1>Registration</h1>

      {/* Display validation errors */}
      {errors.length > 0 && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          <ul>
            {errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexFlow: 'column', marginBottom: '10px' }}>
        <label>First Name</label>
        <input value={firstname} onChange={e => setFirstname(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexFlow: 'column', marginBottom: '10px' }}>
        <label>Last Name</label>
        <input value={lastname} onChange={e => setLastname(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexFlow: 'column', marginBottom: '10px' }}>
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexFlow: 'column', marginBottom: '10px' }}>
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexFlow: 'column', marginBottom: '10px' }}>
        <button disabled={processing} onClick={register}>
          Register
        </button>
      </div>
      <a style={{ marginTop: '30px' }} href="#" onClick={() => navigate('/login')}>
        Already have an account? Click here to login.
      </a>
      <a style={{ marginTop: '30px' }} href="#" onClick={() => navigate('/activate')}>
        Need to activate your account? Click here.
      </a>
    </div>
  );
};
