import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/core/Input';
import { Button } from '../components/core/Button';
import { getFriendlyErrorMessage } from '../lib/errors'; 

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 1. The 'error' state starts as an empty string
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear any old errors
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      console.error(err); // Good for debugging
      alert("username or password invalid");
      // 2. We set the 'error' state with the friendly message
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {/* 3. THIS IS THE FIX: This line will now work.
          When 'error' is not empty, React will render this <p> tag 
          and show the message on the screen.
      */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button type="submit" isLoading={loading}>
        Unlock Vault
      {/* 4. THE TYPO IS FIXED: This is now correctly </Button> */}
      </Button> 

      <p className="text-center text-grey-mid">
        No account?{' '}
        <Link to="/signup" className="text-pure-white hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
};

export default Login;