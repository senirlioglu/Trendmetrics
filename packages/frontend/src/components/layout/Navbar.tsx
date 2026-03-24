import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  LayoutDashboard,
  FileText,
  Wallet,
  LogOut,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reports', label: 'Reports', icon: FileText },
];

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white hidden sm:block">
              TrendMetrics
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-500/10 text-primary-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <>
                {/* Balance */}
                <div className="flex items-center gap-1.5 rounded-lg bg-gray-900/50 border border-gray-800 px-3 py-1.5">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">
                    ${user.balance.toFixed(2)}
                  </span>
                </div>

                {/* Top Up */}
                <Link
                  to="/topup"
                  className="flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Top Up
                </Link>

                {/* User */}
                <div className="flex items-center gap-2">
                  {user.photo_url ? (
                    <img
                      src={user.photo_url}
                      alt={user.display_name}
                      className="h-8 w-8 rounded-full border border-gray-700"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/20 text-primary-400 text-sm font-bold">
                      {user.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-gray-300 max-w-[120px] truncate">
                    {user.display_name}
                  </span>
                </div>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-gray-800"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-500/10 text-primary-400'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                );
              })}

              {user && (
                <>
                  <div className="border-t border-gray-800 pt-2 mt-2" />

                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      {user.photo_url ? (
                        <img
                          src={user.photo_url}
                          alt={user.display_name}
                          className="h-8 w-8 rounded-full border border-gray-700"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/20 text-primary-400 text-sm font-bold">
                          {user.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-gray-300">{user.display_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">
                        ${user.balance.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Link
                    to="/topup"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Top Up Credits
                  </Link>

                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
