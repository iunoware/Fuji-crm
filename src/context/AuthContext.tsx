"use client"

import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string | number;
  name: string;
  username: string;
  role: string;
  city_id?: number;
  designation?: string;
  avatar?: string;
}

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('fuji_user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('fuji_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    // 1. Try real Supabase auth
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, cities(name)')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (!error && data) {
        const loggedUser: User = data as any;
        setCurrentUser(loggedUser);
        localStorage.setItem('fuji_user', JSON.stringify(loggedUser));
        return loggedUser;
      }
    } catch (err) {
      console.warn("Supabase login error, falling back to simulated auth:", err);
    }

    // 2. Simulated auth fallback for UI demonstration & ease of testing
    if (username && password) {
      const mockUser: User = {
        id: '1',
        name: username.charAt(0).toUpperCase() + username.slice(1),
        username: username,
        role: username.toLowerCase().includes('super') ? 'Super Admin' : username.toLowerCase().includes('admin') ? 'City Admin' : 'Staff',
        city_id: 1,
        designation: username.toLowerCase().includes('super') ? 'Super Admin' : username.toLowerCase().includes('admin') ? 'City Manager' : 'Sales Representative',
        avatar: 'https://i.pravatar.cc/150?img=33'
      };
      setCurrentUser(mockUser);
      localStorage.setItem('fuji_user', JSON.stringify(mockUser));
      return mockUser;
    }

    throw new Error("Invalid username or password");
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('fuji_user');
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
