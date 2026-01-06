import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { mockUsers, User } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  register: (data: RegisterData) => Promise<{ success: boolean; message: string }>;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; message: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'patient' | 'doctor';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('medicare_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const foundUser = mockUsers.find(u => u.email === email && u.password === password);
    
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('medicare_user', JSON.stringify(foundUser));
      return { success: true, message: 'Connexion réussie' };
    }
    
    return { success: false, message: 'Email ou mot de passe incorrect' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('medicare_user');
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; message: string }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if email already exists
    const existingUser = mockUsers.find(u => u.email === data.email);
    if (existingUser) {
      return { success: false, message: 'Cet email est déjà utilisé' };
    }

    // Create new user (in real app, this would be saved to database)
    const newUser: User = {
      id: `user-${Date.now()}`,
      email: data.email,
      password: data.password,
      role: data.role,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone
    };

    // Add to mock users (for demo purposes)
    mockUsers.push(newUser);
    
    setUser(newUser);
    localStorage.setItem('medicare_user', JSON.stringify(newUser));
    
    return { success: true, message: 'Inscription réussie' };
  };

  const updateProfile = async (data: Partial<User>): Promise<{ success: boolean; message: string }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (!user) {
      return { success: false, message: 'Non connecté' };
    }

    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem('medicare_user', JSON.stringify(updatedUser));
    
    return { success: true, message: 'Profil mis à jour' };
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (!user) {
      return { success: false, message: 'Non connecté' };
    }

    if (user.password !== currentPassword) {
      return { success: false, message: 'Mot de passe actuel incorrect' };
    }

    const updatedUser = { ...user, password: newPassword };
    setUser(updatedUser);
    localStorage.setItem('medicare_user', JSON.stringify(updatedUser));
    
    return { success: true, message: 'Mot de passe modifié' };
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
      changePassword
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
