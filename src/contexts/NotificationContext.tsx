import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { mockNotifications, Notification } from '@/data/mockData';
import { toast } from 'sonner';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Show toast for new notification
    toast(notification.title, {
      description: notification.message,
      duration: 5000
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Simulate real-time notifications (for demo)
  useEffect(() => {
    const interval = setInterval(() => {
      const random = Math.random();
      if (random < 0.1) { // 10% chance every 30 seconds
        const types = ['appointment', 'patient_arrival', 'exam_result', 'pharmacy'] as const;
        const type = types[Math.floor(Math.random() * types.length)];
        
        const messages: Record<typeof type, { title: string; message: string }> = {
          appointment: { title: 'Nouveau RDV', message: 'Un patient a demandé un nouveau rendez-vous' },
          patient_arrival: { title: 'Arrivée patient', message: 'Un patient vient d\'arriver à l\'accueil' },
          exam_result: { title: 'Résultats prêts', message: 'De nouveaux résultats d\'examen sont disponibles' },
          pharmacy: { title: 'Alerte stock', message: 'Un produit pharmaceutique est en rupture' }
        };
        
        addNotification({ type, ...messages[type] });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}