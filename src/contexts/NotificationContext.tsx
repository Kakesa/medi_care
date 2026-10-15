import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Notification } from '@/data/mockData';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService } from '@/services/notificationService';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const refreshNotifications = useCallback(() => {
    window.dispatchEvent(new Event('notifications:refresh'));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    let active = true;
    const known = new Set<string>();
    let ready = false;

    const load = async () => {
      try {
        const page = await notificationService.getAll({ limit: 30 });
        if (!active) return;
        const incoming = page.data as Notification[];
        if (ready) {
          incoming.filter((item) => !item.read && !known.has(item.id)).forEach((item) => {
            toast(item.title, { description: item.message, duration: 5000 });
          });
        }
        known.clear();
        incoming.forEach((item) => known.add(item.id));
        ready = true;
        setNotifications(incoming);
      } catch {
        if (active && !ready) setNotifications([]);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 20000);
    const onRefresh = () => void load();
    window.addEventListener('notifications:refresh', onRefresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('notifications:refresh', onRefresh);
    };
  }, [isAuthenticated]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    toast(notification.title, { description: notification.message, duration: 5000 });
    window.dispatchEvent(new Event('notifications:refresh'));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    void notificationService.markAsRead(id).catch(() => undefined);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    void notificationService.markAllAsRead().catch(() => undefined);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    void notificationService.markAsRead(id).catch(() => undefined);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotification,
      refreshNotifications
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
