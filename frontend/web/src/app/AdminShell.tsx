import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  UserCheck,
  Package,
  ShoppingCart,
  Activity,
  Users,
  ArrowLeft,
  Menu,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from './RequireRole';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import logoImg from '@/assets/brand/lavitree-logo-64.webp';

interface AdminNavItem {
  name: string;
  to: string;
  icon: React.ElementType;
}

const adminNavItems: AdminNavItem[] = [
  { name: 'Tổng quan', to: '/admin', icon: LayoutDashboard },
  { name: 'Thu thập Tri thức', to: '/admin/knowledge', icon: Database },
  { name: 'Ca chuyên gia', to: '/admin/escalations', icon: UserCheck },
  { name: 'Kho vật tư & thuốc', to: '/admin/inventory', icon: Package },
  { name: 'Đơn hàng', to: '/admin/orders', icon: ShoppingCart },
  { name: 'Agent Traces', to: '/admin/traces', icon: Activity },
  { name: 'Người dùng & Quyền', to: '/admin/users', icon: Users },
];

export const AdminShell: React.FC = () => {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('lavitree_token');
    localStorage.removeItem('lavitree_user');
    window.location.href = '/login';
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Brand & Admin Badge */}
      <div className="p-5 border-b border-border flex items-center space-x-3">
        <img src={logoImg} alt="Lavitree Logo" className="w-8 h-8 object-contain" />
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-lg text-primary tracking-tight">Lavitree</span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-secondary text-primary rounded-md uppercase">
              Admin
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Cổng Quản trị Vận hành</span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-secondary text-primary font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Back to User Portal & Profile */}
      <div className="p-4 border-t border-border space-y-3 bg-muted/20">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-border bg-card hover:bg-muted"
          asChild
        >
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
            <span>Về trang người dùng</span>
          </Link>
        </Button>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-xs font-semibold truncate text-foreground">
              {user?.fullName || user?.email || 'Quản trị viên'}
            </span>
            <span className="text-[11px] text-muted-foreground">Admin Portal</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased selection:bg-brand-mint/40 selection:text-primary">
      {/* Desktop Sidebar (>= 1024px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-30">
        <SidebarContent />
      </aside>

      {/* Main Body */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Mobile Header (< 1024px) */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between h-14 px-4 border-b border-border bg-card/95 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="w-5 h-5" />
                  <span className="sr-only">Mở menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SheetHeader className="sr-only">
                  <SheetTitle>Admin Navigation Menu</SheetTitle>
                </SheetHeader>
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <span className="font-bold text-base text-primary">Lavitree Admin</span>
          </div>

          <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
            <Link to="/">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về Web</span>
            </Link>
          </Button>
        </header>

        {/* Content area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
