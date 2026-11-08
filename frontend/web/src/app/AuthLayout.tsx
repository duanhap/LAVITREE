import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft, Leaf, MessageCircle, ScanLine } from 'lucide-react';
import { HeroVideoBackground } from '@/components/brand/HeroVideoBackground';
import logoImg from '@/assets/brand/lavitree-logo-64.webp';
import lavi3dImg from '@/assets/brand/lavi-3d-happy-720.webp';

const highlights = [
  { icon: ScanLine, text: 'Chụp một tấm lá, biết ngay cây đang bị bệnh gì' },
  { icon: Leaf, text: 'Hướng xử lý theo khuyến cáo khuyến nông, ưu tiên an toàn' },
  { icon: MessageCircle, text: 'Hỏi Lavi bất cứ lúc nào về vườn của bạn' },
];

/**
 * Bố cục cho Đăng nhập / Đăng ký: nền video lá cây toàn màn hình.
 * Desktop: giới thiệu + Lavi 3D bên trái, form bên phải. Mobile: chỉ form trên nền video.
 */
export const AuthLayout: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-emerald-950 text-white antialiased">
      <HeroVideoBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <img src={logoImg} alt="" className="h-9 w-9 object-contain drop-shadow" />
            <span className="text-xl font-bold tracking-tight">Lavitree</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Về trang chủ</span>
          </Link>
        </header>

        <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-10 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Giới thiệu (chỉ desktop) */}
          <section className="hidden lg:block">
            <div className="flex items-end gap-6">
              <img
                src={lavi3dImg}
                alt="Lavi, trợ lý cây trồng của Lavitree"
                className="w-48 shrink-0 drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)] motion-safe:animate-[lavi-float_5s_ease-in-out_infinite]"
              />
              <div className="pb-4">
                <p className="text-sm font-medium text-emerald-200">Xin chào, mình là Lavi</p>
                <h1 className="mt-1 text-4xl font-extrabold leading-tight tracking-tight">
                  Bác sĩ cây trồng
                  <br />
                  trong túi của bạn
                </h1>
              </div>
            </div>
            <ul className="mt-8 space-y-3">
              {highlights.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-base text-white/90">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </section>

          {/* Form */}
          <section className="w-full max-w-md justify-self-center text-foreground lg:justify-self-end">
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  );
};

export default AuthLayout;
