import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  History,
  LogIn,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  Phone,
  CalendarDays,
  Shield,
  UserPlus,
  ShoppingBag,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import laviHappyImg from '@/assets/brand/lavi-3d-happy-720.webp';

interface MeResponse {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: string;
  created_at?: string;
}

interface MenuItem {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const GUEST_BENEFITS = [
  'Lưu lại lịch sử khám lá để theo dõi cây hồi phục',
  'Đặt mua vật tư và xem lại đơn hàng',
  'Trò chuyện với Lavi không giới hạn 5 lượt/ngày như khách',
];

/** W-10: Tài khoản. Khách thấy lời mời đăng nhập; người đã đăng nhập thấy hồ sơ và lối tắt. */
export const AccountPage: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // Thông tin trong JWT không có số điện thoại / ngày tạo; lấy bản đầy đủ từ Core
  const { data: me } = useQuery({
    queryKey: ['auth', 'me', user?.id],
    queryFn: async () => (await apiClient.get<MeResponse>('/auth/me')).data,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-md py-6">
        <Card className="overflow-hidden border-border shadow-sm">
          <div className="bg-brand-mint-soft/60 px-6 pt-6 text-center">
            <img src={laviHappyImg} alt="" className="mx-auto h-28 w-28 object-contain" />
          </div>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-1 text-center">
              <h1 className="text-xl font-bold text-foreground">Bạn chưa đăng nhập</h1>
              <p className="text-sm text-muted-foreground">
                Vẫn khám lá được như bình thường. Đăng nhập để Lavi nhớ vườn của bạn.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-foreground">
              {GUEST_BENEFITS.map((text) => (
                <li key={text} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <div className="grid gap-2">
              <Button asChild className="h-11 font-semibold">
                <Link to="/login?next=%2Faccount">
                  <LogIn className="mr-2 h-4 w-4" /> Đăng nhập
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11">
                <Link to="/register?next=%2Faccount">
                  <UserPlus className="mr-2 h-4 w-4" /> Tạo tài khoản miễn phí
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName = me?.full_name || user.fullName || user.email.split('@')[0];
  const phone = me?.phone ?? user.phone;
  const createdAt = me?.created_at ?? user.createdAt;

  const menu: MenuItem[] = [
    { to: '/history', label: 'Lịch sử khám', description: 'Các lần khám lá đã lưu', icon: History },
    { to: '/orders', label: 'Đơn hàng của tôi', description: 'Theo dõi đơn vật tư', icon: Package },
    { to: '/chat', label: 'Trò chuyện với Lavi', description: 'Hỏi thêm về vườn của bạn', icon: MessageSquare },
    { to: '/store', label: 'Cửa hàng vật tư', description: 'Thuốc và vật tư theo bệnh', icon: ShoppingBag },
  ];
  if (user.role === 'ADMIN') {
    menu.push({ to: '/admin', label: 'Trang quản trị', description: 'Tri thức, kho, ca cần duyệt', icon: Shield });
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-2">
      <Card className="border-border shadow-sm">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16 border border-border">
            <AvatarFallback className="bg-secondary text-2xl font-bold text-primary">
              {fullName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-foreground">{fullName}</h1>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-primary">
                {user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhà nông'}
              </span>
            </div>
            <dl className="grid gap-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <dt className="sr-only">Email</dt>
                <dd className="truncate">{user.email}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <dt className="sr-only">Số điện thoại</dt>
                <dd>{phone || 'Chưa có số điện thoại'}</dd>
              </div>
              {createdAt && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <dt className="sr-only">Ngày tham gia</dt>
                  <dd>Tham gia từ {formatDate(createdAt, false)}</dd>
                </div>
              )}
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <nav aria-label="Lối tắt tài khoản" className="divide-y divide-border">
          {menu.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-[64px] items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ))}
        </nav>
      </Card>

      <Button
        type="button"
        variant="outline"
        onClick={handleLogout}
        className="h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
      >
        <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
      </Button>
    </div>
  );
};

export default AccountPage;
