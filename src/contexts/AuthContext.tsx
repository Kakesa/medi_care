import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services/authService';
import { getAuthToken, removeAuthToken, setAuthToken } from '@/services/config';
import type { ApiError, User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    organizationSlug: string;
  }) => Promise<{ success: boolean; message: string }>;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; message: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as ApiError).message || fallback);
  }
  return fallback;
}

function persistUser(user: User) {
  localStorage.setItem('medicare_user', JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      const token = getAuthToken();
      if (!token) {
        localStorage.removeItem('medicare_user');
        if (active) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const current = await authService.getCurrentUser();
        if (active) {
          setUser(current);
          persistUser(current);
        }
      } catch {
        removeAuthToken();
        localStorage.removeItem('medicare_user');
        if (active) setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void restore();

    const onExpired = () => {
      setUser(null);
      localStorage.removeItem('medicare_user');
    };
    window.addEventListener('auth:expired', onExpired);

    return () => {
      active = false;
      window.removeEventListener('auth:expired', onExpired);
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      setUser(response.user);
      persistUser(response.user);
      return { success: true, message: 'Connexion réussie' };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Email ou mot de passe incorrect') };
    }
  };

  const logout = () => {
    void authService.logout();
    setUser(null);
    localStorage.removeItem('medicare_user');
  };

  const register = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    organizationSlug: string;
  }) => {
    try {
      const response = await authService.register(data);
      setUser(response.user);
      persistUser(response.user);
      return { success: true, message: 'Inscription réussie' };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Inscription impossible') };
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const updated = await authService.updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      });
      setUser(updated);
      persistUser(updated);
      return { success: true, message: 'Profil mis à jour' };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Mise à jour impossible') };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authService.changePassword(currentPassword, newPassword);
      if (response.token) {
        setAuthToken(response.token);
      }
      if (response.user) {
        setUser(response.user);
        persistUser(response.user);
      }
      return { success: true, message: response.message || 'Mot de passe modifié' };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Modification impossible') };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      register,
      updateProfile,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
