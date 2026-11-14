import React, { useState, useEffect } from 'react';
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
  FileText,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
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
  { name: 'Nhập bài báo', to: '/admin/ingest', icon: FileText },
  { name: 'Duyệt tri thức', to: '/admin/knowledge', icon: Database },
  { name: 'Ảnh triệu chứng', to: '/admin/images', icon: ImageIcon },
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('lavitree_admin_sidebar_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('lavitree_admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('lavitree_token');
    localStorage.removeItem('lavitree_user');
    window.location.href = '/login';
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isMini = collapsed && !isMobile;

    return (
      <div className="flex flex-col h-full bg-card border-r border-border transition-all duration-200">
        {/* Brand & Admin Badge + Nút thu nhỏ menu */}
        <div className={cn(
          'border-b border-border flex items-center transition-all duration-200',
          isMini ? 'p-3 flex-col gap-2 justify-center' : 'p-4 justify-between'
        )}>
          <div className="flex items-center space-x-2.5 min-w-0">
            <img src={logoImg} alt="Lavitree Logo" className="w-8 h-8 object-contain shrink-0" />
            {!isMini && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-base text-primary tracking-tight">Lavitree</span>
                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-secondary text-primary rounded uppercase">
                    Admin
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground truncate">Quản trị vận hành</span>
              </div>
            )}
          </div>

          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
              title={isMini ? 'Mở rộng menu (Ctrl+B)' : 'Thu nhỏ menu'}
            >
              {isMini ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Nav List */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                onClick={() => setMobileOpen(false)}
                title={isMini ? item.name : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isMini ? 'justify-center p-2.5' : 'space-x-3 px-3 py-2',
                    isActive
                      ? 'bg-secondary text-primary font-bold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isMini && <span className="truncate">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Back to User Portal & Profile */}
        <div className={cn(
          'border-t border-border bg-muted/20 transition-all duration-200',
          isMini ? 'p-2 space-y-2' : 'p-3 space-y-2.5'
        )}>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'border-border bg-card hover:bg-muted text-xs',
              isMini ? 'w-full p-0 h-8 justify-center' : 'w-full justify-start gap-2'
            )}
            asChild
            title={isMini ? 'Về trang người dùng' : undefined}
          >
            <Link to="/">
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              {!isMini && <span>Về Web người dùng</span>}
            </Link>
          </Button>

          <div className={cn(
            'pt-2 border-t border-border flex items-center',
            isMini ? 'flex-col gap-2 justify-center' : 'justify-between'
          )}>
            {!isMini && (
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-xs font-semibold truncate text-foreground">
                  {user?.fullName || user?.email || 'Quản trị viên'}
                </span>
                <span className="text-[10px] text-muted-foreground">Admin Portal</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              onClick={handleLogout}
              title="Đăng xuất"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground antialiased selection:bg-brand-mint/40 selection:text-primary">
      {/* Desktop Sidebar (>= 1024px) */}
      <aside className={cn(
        'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-30 transition-all duration-200',
        collapsed ? 'lg:w-16' : 'lg:w-60'
      )}>
        <SidebarContent />
      </aside>

      {/* Main Body */}
      <div className={cn(
        'flex-1 flex flex-col min-h-screen transition-all duration-200',
        collapsed ? 'lg:pl-16' : 'lg:pl-60'
      )}>
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
                <SidebarContent isMobile />
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
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
