import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/core/Input';
import { Button } from '../components/core/Button';
import { getFriendlyErrorMessage } from '../lib/errors';

const SignUp: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError('');
    setLoading(true);

    try {
      await signup(email, password, username);
      navigate('/');
    } catch (err: any) {
      console.error(err);
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
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      
      {error && <p className="text-red-500 text-sm">{error}</p>}
      
      <Button type="submit" isLoading={loading}>
        {loading ? 'Generating Keys...' : 'Create & Secure Vault'}
      </Button>
      
      {/* Theme-aware link */}
      <p className="text-center text-grey-dark dark:text-grey-mid">
        Already have an account?{' '}
        <Link to="/login" className="text-night dark:text-pure-white hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
};

export default SignUp;