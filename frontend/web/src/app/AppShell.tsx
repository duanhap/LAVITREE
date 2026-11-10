import React from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Scan,
  BookOpen,
  MessageSquare,
  ShoppingBag,
  User as UserIcon,
  LogOut,
  Shield,
  History,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from './RequireRole';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import logoImg from '@/assets/brand/lavitree-logo-64.webp';

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Khám lá', to: '/', icon: Scan },
  { name: 'Sổ tay', to: '/handbook', icon: BookOpen },
  { name: 'Trợ lý', to: '/chat', icon: MessageSquare },
  { name: 'Cửa hàng', to: '/store', icon: ShoppingBag },
  { name: 'Tài khoản', to: '/account', icon: UserIcon },
];

import { useAuth } from '@/context/AuthContext';

export const AppShell: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-brand-mint/40 selection:text-primary">
      {/* ================= DESKTOP HEADER (>= 768px) ================= */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link
            to="/"
            className="hidden md:flex items-center space-x-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
          >
            <img
              src={logoImg}
              alt="Lavitree Logo"
              className="w-9 h-9 object-contain group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-primary font-sans leading-none">
                Lavitree
              </span>
              <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Bác sĩ cây trồng
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-secondary text-primary shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Desktop Auth / User Action */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative flex items-center gap-2.5 h-10 px-2 rounded-full hover:bg-muted"
                  >
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarFallback className="bg-secondary text-primary font-bold text-xs">
                        {user.fullName ? user.fullName[0].toUpperCase() : user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium max-w-[120px] truncate text-foreground">
                      {user.fullName || user.email.split('@')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{user.fullName || 'Người dùng'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-secondary text-primary rounded-full w-fit">
                        {user.role}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/account')}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Tài khoản của tôi</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/history')}>
                    <History className="mr-2 h-4 w-4" />
                    <span>Lịch sử khám</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/orders')}>
                    <Package className="mr-2 h-4 w-4" />
                    <span>Đơn hàng của tôi</span>
                  </DropdownMenuItem>
                  {user.role === 'ADMIN' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Shield className="mr-2 h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">Trang Quản trị</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className="font-medium">
                <Link to="/login">Đăng nhập</Link>
              </Button>
            )}
          </div>

          {/* Mobile Top Brand Bar (Visible only on mobile < 768px) */}
          <div className="flex md:hidden items-center justify-between w-full">
            <Link to="/" className="flex items-center space-x-2">
              <img src={logoImg} alt="Lavitree Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold text-lg tracking-tight text-primary font-sans">Lavitree</span>
            </Link>
            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-9 w-9"
                onClick={() => navigate('/account')}
              >
                <Avatar className="h-7 w-7 border border-border">
                  <AvatarFallback className="bg-secondary text-primary font-bold text-xs">
                    {(user?.fullName || user?.email || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="h-8 text-xs px-3">
                <Link to="/login">Đăng nhập</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT AREA ================= */}
      {/* Khi ở trang /chat: Bung full màn hình như Messenger / ChatGPT (không giới hạn max-w) */}
      <main
        className={cn(
          "flex-1 w-full",
          location.pathname.startsWith('/chat')
            ? "h-[calc(100vh-4rem)] p-0 m-0 max-w-none overflow-hidden pb-16 md:pb-0"
            : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8"
        )}
      >
        <Outlet />
      </main>

      {/* ================= MOBILE BOTTOM TAB BAR (< 768px) ================= */}
      {/* Fixed at bottom, 5 items matching screens.md section 3 */}
      <nav
        aria-label="Điều hướng chính di động"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 shadow-lg"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center w-full h-full py-1 text-[11px] font-medium transition-colors select-none focus-visible:outline-none',
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      'p-1 rounded-full transition-transform',
                      isActive ? 'bg-secondary text-primary scale-110' : ''
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="mt-0.5 tracking-tight">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default AppShell;
