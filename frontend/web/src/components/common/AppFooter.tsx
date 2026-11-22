import React from 'react';
import { Link } from 'react-router-dom';
import {
  Scan,
  BookOpen,
  MessageSquare,
  ShoppingBag,
  ShieldCheck,
  Leaf,
  GraduationCap,
  Mail,
  MapPin,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react';
import logoImg from '@/assets/brand/lavitree-logo-64.webp';

export const AppFooter: React.FC = () => {
  return (
    <footer className="w-full border-t border-emerald-900/50 bg-[#0B1E13] text-white mt-auto relative overflow-hidden">
      {/* Vầng sáng hữu cơ trang trí nền footer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,rgba(46,107,63,0.35),transparent_70%)]"
      />

      {/* Main Footer Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Cột 1: Thương hiệu & Sứ mệnh */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center space-x-3 group w-fit">
              <div className="relative flex items-center justify-center p-1 rounded-xl bg-emerald-900/50 border border-emerald-500/30 shadow-xs">
                <img
                  src={logoImg}
                  alt="Lavitree Logo"
                  className="w-8 h-8 object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight text-white font-sans leading-none">
                  Lavitree
                </span>
                <span className="text-[11px] text-emerald-400 font-medium mt-0.5">
                  Bác sĩ cây trồng thông minh
                </span>
              </div>
            </Link>

            <p className="text-xs text-emerald-100/75 leading-relaxed">
              Hệ thống nhận diện bệnh hại cây trồng bằng Trí tuệ nhân tạo (AI Vision & Hybrid RAG), tích hợp phác đồ điều trị IPM và tư vấn nông nghiệp thông minh vì nền nông nghiệp sạch Việt Nam.
            </p>

            <div className="flex flex-col gap-1.5 pt-1 text-[11px] text-emerald-100/80">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
                Đề tài Đồ án Tốt nghiệp Kỹ sư CNTT
              </span>
              <span className="text-emerald-100/60 pl-5.5">
                Học viện Công nghệ Bưu chính Viễn thông (PTIT)
              </span>
            </div>
          </div>

          {/* Cột 2: Điều hướng nhanh */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Tính năng chính
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/"
                  className="text-emerald-100/75 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <Scan className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Khám bệnh lá cây (AI Vision)</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/handbook"
                  className="text-emerald-100/75 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Sổ tay bệnh học 14 cây trồng</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/chat"
                  className="text-emerald-100/75 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Trợ lý AI Lavi tư vấn trực tuyến</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/store"
                  className="text-emerald-100/75 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Cửa hàng Vật tư & Thuốc BVTV</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/history"
                  className="text-emerald-100/75 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <Leaf className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Lịch sử khám bệnh cây</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 3: Nền tảng Khoa học & Pháp lý */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Cơ sở khoa học & Tiêu chuẩn
            </h3>
            <ul className="space-y-2 text-xs text-emerald-100/75">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Mô hình ResNet-18 + Grad-CAM Heatmap khoanh vùng tổn thương lá</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>FastMCP Agent + ChromaDB Hybrid RAG (BGE-M3 Multilingual)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Bộ dữ liệu 14 cây trồng & 40 bệnh hại nông nghiệp phổ biến</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Chốt chặn danh mục chất cấm Thông tư 75/2025/TT-BNNMT</span>
              </li>
            </ul>
          </div>

          {/* Cột 4: Đơn vị nghiên cứu & Liên hệ */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Đơn vị nghiên cứu & Hỗ trợ
            </h3>
            <div className="space-y-2.5 text-xs text-emerald-100/75">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Khoa Công nghệ Thông tin — Học viện Công nghệ Bưu chính Viễn thông (Km10, Nguyễn Trãi, Hà Đông, Hà Nội)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono text-[11px] text-emerald-200">support@lavitree.io.vn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dòng bản quyền & Căn cứ pháp lý Điều 25 Luật SHTT */}
        <div className="mt-12 pt-6 border-t border-emerald-900/60 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left text-[11px] text-emerald-100/60">
          <div className="space-y-1">
            <p className="font-medium text-emerald-100/90">
              © 2026 Lavitree Project. Bản quyền thuộc về Nhóm Nghiên cứu Đồ án Tốt nghiệp PTIT.
            </p>
            <p className="text-[10px] text-emerald-100/50 max-w-3xl leading-relaxed">
              Trích dẫn tài liệu kỹ thuật và khuyến nông phục vụ nghiên cứu khoa học, giáo dục & phi thương mại theo quy định tại Điều 25 Luật Sở hữu trí tuệ Việt Nam. Người nông dân cần đọc kỹ hướng dẫn trên bao bì thuốc bảo vệ thực vật trước khi sử dụng thực tế.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[10px]">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-500/30 font-medium text-emerald-300">
              <HeartHandshake className="w-3 h-3 text-emerald-400" /> Nông nghiệp Xanh & Bền vững
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
