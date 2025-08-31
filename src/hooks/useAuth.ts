import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string;
}

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token and validate it
    const token = localStorage.getItem('auth-token');
    if (token) {
      // In a real app, you would validate the token with the backend
      // For now, we'll just check if it exists
      try {
        const userData = localStorage.getItem('user-data');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
        localStorage.removeItem('auth-token');
        localStorage.removeItem('user-data');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // In a real app, this would make an API call
      // For demo purposes, we'll simulate a successful login
      const mockUser: User = {
        id: '1',
        email,
        username: email.split('@')[0],
        firstName: '张',
        lastName: '律师',
        role: 'LAWYER',
      };

      const mockToken = 'mock-jwt-token';
      
      localStorage.setItem('auth-token', mockToken);
      localStorage.setItem('user-data', JSON.stringify(mockUser));
      setUser(mockUser);
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('user-data');
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      // In a real app, this would make an API call
      const updatedUser = { ...user, ...data };
      localStorage.setItem('user-data', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      console.error('Profile update error:', err);
      throw err;
    }
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    updateProfile,
  };
};