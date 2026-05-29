'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationMenu } from '@/components/NotificationMenu';
import { useAuthStore } from '@/store/authStore';
import { useSocket } from '@/contexts/SocketProvider';
import { fetchWithAuth } from '@/lib/fetchClient';

interface AdminShellProps {
  children: ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const loginUser = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);
  const logoutUser = useAuthStore((s) => s.logout);
  const { socket } = useSocket();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<
    { id: number; createdAt: string; message: string; isRead: boolean }[]
  >([]);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetchWithAuth('/api/auth?action=profile', {
          credentials: 'include',
        });
        if (!res.ok) {
          router.replace('/login');
          setIsAuthorized(false);
          return;
        }
        const userData = await res.json();
        loginUser(userData);

        if (userData.role !== 'admin') {
          router.replace('/dashboard');
          setIsAuthorized(false);
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        router.replace('/login');
        setIsAuthorized(false);
      }
    }

    if (!user) {
      fetchProfile();
    } else {
      if (user.role !== 'admin') {
        router.replace('/dashboard');
        setIsAuthorized(false);
      } else {
        setIsAuthorized(true);
      }
    }
  }, [user, loginUser, router]);

  // Fetch notifications once
  useEffect(() => {
    if (isAuthorized) {
      const fetchNotifications = async () => {
        try {
          const res = await fetchWithAuth('/api/notification?action=getAll', {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            setNotifications(data);
          }
        } catch (error) {
          console.error('Error fetching notifications:', error);
        }
      };

      fetchNotifications();
    }
  }, [isAuthorized]);

  // Listen for real-time socket updates
  useEffect(() => {
    if (!socket) return;

    socket.on('notification:new', (newNotification) => {
      setNotifications((prev) => [newNotification, ...prev]);
    });

    socket.on('notification:delete', (deletedId) => {
      setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
    });

    return () => {
      socket.off('notification:new');
      socket.off('notification:delete');
    };
  }, [socket]);

  const handleLogout = async () => {
    await fetchWithAuth('/api/auth?action=logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    logoutUser();
    router.replace('/login');
  };

  if (isAuthorized === null || !isAuthorized) {
    return null;
  }

  const navLinks = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/tasks', label: 'Tasks' },
    { href: '/admin/requests', label: 'Requests' },
    { href: '/admin/profile', label: 'Profile' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex h-16 items-center justify-center border-b border-gray-200 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">
          MicroSphere
        </div>

        <nav className="mt-4 flex flex-col space-y-1 px-2">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-800">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin</h1>
          <div>
            <NotificationMenu notifications={notifications} />
            <Button
              size="icon"
              variant="outline"
              className="ml-5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-600"
              onClick={handleLogout}
              type="button"
            >
              <LogOut className="h-8 w-8" />
            </Button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
