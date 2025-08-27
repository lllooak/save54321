import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  DollarSign,
  User,
  TrendingUp,
  Film,
  Users
} from 'lucide-react';

export function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    {
      path: '/dashboard/creator',
      icon: LayoutDashboard,
      label: 'סקירה כללית',
    },
    {
      path: '/dashboard/creator/video-ads',
      icon: Film,
      label: 'מודעות וידאו',
    },
    {
      path: '/dashboard/creator/requests',
      icon: Video,
      label: 'בקשות',
    },
    {
      path: '/dashboard/creator/earnings',
      icon: DollarSign,
      label: 'הכנסות',
    },
    {
      path: '/dashboard/creator/profile',
      icon: User,
      label: 'פרופיל',
    },
    {
      path: '/dashboard/creator/analytics',
      icon: TrendingUp,
      label: 'ניתוח נתונים',
    },
    {
      path: '/dashboard/creator/affiliate',
      icon: Users,
      label: 'תוכנית שותפים',
    },
  ];

  return (
    <div className="fixed right-0 top-0 h-full w-64 bg-white border-l border-gray-200">
      <div className="p-6">
        <Link to="/" className="text-xl font-bold text-primary-600">
          לוח בקרה ליוצר
        </Link>
      </div>
      <nav className="mt-6">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-6 py-3 text-sm font-medium ${
              currentPath === item.path
                ? 'text-primary-600 bg-primary-50'
                : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
            }`}
          >
            <item.icon className="h-5 w-5 ml-3" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}