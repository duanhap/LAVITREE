import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ResultStatusBadge } from '@/features/diagnose/components/ResultStatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { toast } from 'sonner';

// Brand assets
import logo256 from '@/assets/brand/lavitree-logo-256.webp';
import logo64 from '@/assets/brand/lavitree-logo-64.webp';
import laviAvatar192 from '@/assets/brand/lavi-avatar-192.webp';
import laviAvatar96 from '@/assets/brand/lavi-avatar-96.webp';
import laviFull512 from '@/assets/brand/lavi-full-512.webp';
import lavi3d720 from '@/assets/brand/lavi-3d-happy-720.webp';

import {
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Camera,
  ExternalLink,
} from 'lucide-react';

interface ColorSwatchProps {
  name: string;
  token: string;
  hex: string;
  bgClass: string;
  textClass?: string;
  borderClass?: string;
  usage: string;
  contrast?: string;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({
  name,
  token,
  hex,
  bgClass,
  textClass = 'text-foreground',
  borderClass = 'border-border',
  usage,
  contrast,
}) => (
  <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
    <div
      className={`h-20 w-full flex items-center justify-center font-mono text-xs font-semibold ${bgClass} ${textClass} border-b ${borderClass}`}
    >
      {hex}
    </div>
    <div className="p-3.5 space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-foreground">{name}</span>
        {contrast && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-primary font-medium">
            {contrast}
          </span>
        )}
      </div>
      <p className="font-mono text-xs text-muted-foreground">{token}</p>
      <p className="text-xs text-muted-foreground pt-1">{usage}</p>
    </div>
  </div>
);

export const StyleguidePage: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-12 py-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand-mint-soft via-card to-secondary p-8 shadow-xs">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Môi trường Phát triển (DEV Mode)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-sans">
            Lavitree Design System
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Hệ thống Design Tokens, kiểu chữ Be Vietnam Pro, màu trạng thái chẩn đoán (classes.md)
            và thư viện linh kiện giao diện shadcn/ui.
          </p>
        </div>
        <img
          src={lavi3d720}
          alt="Lavi Mascot 3D"
          className="hidden md:block absolute -right-6 -bottom-6 w-56 h-56 object-contain pointer-events-none drop-shadow-lg"
        />
      </div>

      {/* 1. BẢNG MÀU CHÍNH & TƯƠNG TÁC */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">1. Bảng màu Nền & Tương tác</h2>
          <p className="text-sm text-muted-foreground">
            Bảng màu chuẩn hóa cho Web & Android theo SSOT ui-ux.md mục 2.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <ColorSwatch
            name="Background"
            token="--background"
            hex="#FAFAF7"
            bgClass="bg-background"
            usage="Nền toàn trang, độ sáng cao cho nông dân ngoài đồng"
          />
          <ColorSwatch
            name="Card / Popover"
            token="--card"
            hex="#FFFFFF"
            bgClass="bg-card"
            usage="Nền thẻ, hộp thoại, bảng"
          />
          <ColorSwatch
            name="Foreground"
            token="--foreground"
            hex="#1C2420"
            bgClass="bg-foreground"
            textClass="text-background"
            usage="Màu chữ chính, độ tương phản 15.2:1"
            contrast="15.2:1"
          />
          <ColorSwatch
            name="Muted Foreground"
            token="--muted-foreground"
            hex="#5B6660"
            bgClass="bg-muted-foreground"
            textClass="text-background"
            usage="Chữ phụ, chú thích, nhãn thứ cấp"
            contrast="5.7:1"
          />
          <ColorSwatch
            name="Primary"
            token="--primary"
            hex="#2E6B3F"
            bgClass="bg-primary"
            textClass="text-primary-foreground"
            usage="Nút hành động chính, link, tab đang chọn"
            contrast="6.4:1"
          />
          <ColorSwatch
            name="Primary Hover"
            token="--primary-hover"
            hex="#245633"
            bgClass="bg-primary-hover"
            textClass="text-primary-foreground"
            usage="Trạng thái hover của nút Primary"
            contrast="8.6:1"
          />
          <ColorSwatch
            name="Secondary"
            token="--secondary"
            hex="#EEF3EC"
            bgClass="bg-secondary"
            textClass="text-primary"
            usage="Nút phụ, nền badge, viền nhẹ"
            contrast="5.7:1"
          />
          <ColorSwatch
            name="Destructive"
            token="--destructive"
            hex="#B91C1C"
            bgClass="bg-destructive"
            textClass="text-destructive-foreground"
            usage="Hành động xóa, cảnh báo nguy hiểm"
            contrast="6.5:1"
          />
        </div>
      </section>

      {/* 2. MÀU TRẠNG THÁI CHẨN ĐOÁN (4 TRẠNG THÁI) */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">
            2. Màu Trạng thái Chẩn đoán (Diagnostic Tokens)
          </h2>
          <p className="text-sm text-muted-foreground">
            Tách biệt hoàn toàn khỏi màu nút bấm. Khớp nguyên văn docs/spec/classes.md mục 4.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ColorSwatch
            name="Reference (Tham khảo)"
            token="--status-ok"
            hex="#115E59 / #CCFBF1"
            bgClass="bg-status-ok-bg"
            textClass="text-status-ok"
            usage="Kết quả tham khảo (không nhầm, không uncertain)"
            contrast="6.7:1"
          />
          <ColorSwatch
            name="Confusion (Dễ nhầm)"
            token="--status-confusion"
            hex="#92400E / #FEF3C7"
            bgClass="bg-status-confusion-bg"
            textClass="text-status-confusion"
            usage="Thuộc Confusion Group (Early Blight vs Target Spot)"
            contrast="6.4:1"
          />
          <ColorSwatch
            name="Uncertain (Chưa chắc chắn)"
            token="--status-uncertain"
            hex="#B91C1C / #FEE2E2"
            bgClass="bg-status-uncertain-bg"
            textClass="text-status-uncertain"
            usage="Độ tin cậy < 70%, guardrail chặn thuốc"
            contrast="5.3:1"
          />
          <ColorSwatch
            name="OOD (Không nhận diện)"
            token="--status-ood"
            hex="#475569 / #F1F5F9"
            bgClass="bg-status-ood-bg"
            textClass="text-status-ood"
            usage="Ảnh ngoài 38 lớp cây trồng hỗ trợ"
            contrast="6.9:1"
          />
        </div>

        {/* Live ResultStatusBadge Demonstration */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>ResultStatusBadge Trực quan</CardTitle>
            <CardDescription>
              Hiển thị đồng thời Icon + Chữ (chuẩn WCAG AA). Không bao giờ chỉ dùng màu đơn thuần.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Kích thước Medium (Mặc định)
              </span>
              <div className="flex flex-wrap gap-3">
                <ResultStatusBadge status="reference" />
                <ResultStatusBadge status="confusion" />
                <ResultStatusBadge status="uncertain" />
                <ResultStatusBadge status="ood" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Kích thước Small & Large
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <ResultStatusBadge status="reference" size="sm" />
                <ResultStatusBadge status="confusion" size="sm" />
                <ResultStatusBadge status="uncertain" size="lg" />
                <ResultStatusBadge status="ood" size="lg" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. MÀU THƯƠNG HIỆU LAVITREE */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">3. Màu Thương hiệu (Lavi Brand)</h2>
          <p className="text-sm text-muted-foreground">
            Lấy mẫu từ logo và mascot Lavi. Chỉ dùng trang trí/hiệu ứng, không dùng làm màu chữ.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorSwatch
            name="Brand Mint"
            token="--brand-mint"
            hex="#A6E3CC"
            bgClass="bg-brand-mint"
            textClass="text-foreground"
            usage="Viền phát sáng, nền minh họa, vòng quanh avatar"
          />
          <ColorSwatch
            name="Brand Mint Soft"
            token="--brand-mint-soft"
            hex="#E6F7F0"
            bgClass="bg-brand-mint-soft"
            textClass="text-foreground"
            usage="Nền bong bóng chat của Lavi, banner chào mừng"
          />
          <ColorSwatch
            name="Brand Glow"
            token="--brand-glow"
            hex="#5EEAD4"
            bgClass="bg-brand-glow"
            textClass="text-foreground"
            usage="Đèn LED, hiệu ứng đang suy luận của Agent"
          />
        </div>
      </section>

      {/* 4. TYPOGRAPHY & ĐỊNH DẠNG VI-VN */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">4. Kiểu chữ Be Vietnam Pro & Định dạng</h2>
          <p className="text-sm text-muted-foreground">
            Tự host offline qua @fontsource/be-vietnam-pro. Cỡ chữ tối thiểu cho nội dung là 16px.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Thang Cỡ chữ Chuẩn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-xs text-muted-foreground">30px / 700 — Tiêu đề trang</span>
                <p className="text-[30px] font-bold leading-tight">Chẩn đoán Sâu bệnh Cà chua</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">24px / 600 — Tiêu đề mục</span>
                <p className="text-[24px] font-semibold">Quy trình Quản lý Dịch hại IPM</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">18px / 600 — Tiêu đề thẻ</span>
                <p className="text-[18px] font-semibold">Bệnh đốm vòng (Early Blight)</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">16px / 400 — Nội dung văn bản (chuẩn ngoài đồng)</span>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Phun thuốc gốc đồng hoặc Mancozeb khi thấy vết bệnh xuất hiện đầu tiên. Tuân thủ
                  thời gian cách ly 7 ngày trước thu hoạch.
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">14px / 500 — Chú thích & mô tả</span>
                <p className="text-sm text-muted-foreground">Vết bệnh hình tròn đồng tâm màu nâu sẫm</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">12px / 500 — Nhãn phụ & huy hiệu</span>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Đã kiểm chứng ngoài đồng
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Định dạng dữ liệu vi-VN (tabular-nums)</CardTitle>
              <CardDescription>Format theo chuẩn locale vi-VN (Intl.NumberFormat)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <span className="text-sm font-medium">Giá tiền sản phẩm:</span>
                <span className="text-base font-semibold font-mono tabular-nums text-primary">
                  {formatCurrency(65000)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <span className="text-sm font-medium">Ngày giờ chẩn đoán:</span>
                <span className="text-base font-medium font-mono tabular-nums">
                  {formatDate('2026-10-31T14:30:00')}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <span className="text-sm font-medium">Độ tin cậy mô hình:</span>
                <span className="text-base font-semibold font-mono tabular-nums text-status-ok">
                  {formatPercent(0.946)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <span className="text-sm font-medium">Thời gian đáp ứng API:</span>
                <span className="text-base font-mono tabular-nums text-muted-foreground">
                  182 ms
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 5. THÀNH PHẦN NÚT BẤM (BUTTONS) */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">5. Các Nút bấm (Buttons)</h2>
          <p className="text-sm text-muted-foreground">
            Vùng bấm tối thiểu 44×44px đảm bảo bấm chính xác bằng ngón cái ngoài đồng ruộng.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Nút chính (Primary)</Button>
              <Button variant="secondary">Nút phụ (Secondary)</Button>
              <Button variant="outline">Nút viền (Outline)</Button>
              <Button variant="destructive">Nút xóa (Destructive)</Button>
              <Button variant="ghost">Nút Ghost</Button>
              <Button variant="link">Nút Liên kết</Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Cỡ nhỏ (sm)</Button>
              <Button size="default">Cỡ vừa (default 44px)</Button>
              <Button size="lg">Cỡ lớn (lg 48px)</Button>
              <Button disabled>Bị vô hiệu (disabled)</Button>
              <Button
                variant="outline"
                onClick={() => toast.success('Đã lưu thông tin chẩn đoán thành công!')}
              >
                Bấm thử Toast Sonner
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 6. HỘP THÔNG BÁO (ALERTS) */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">6. Cảnh báo (Alerts)</h2>
          <p className="text-sm text-muted-foreground">
            Dùng để hiển thị thông điệp hệ thống, guardrail và kết quả phân tích.
          </p>
        </div>

        <div className="space-y-3">
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Chẩn đoán hoàn tất</AlertTitle>
            <AlertDescription>
              Cây trồng khớp với mẫu đối chứng trong thư viện tri thức Lavitree.
            </AlertDescription>
          </Alert>

          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Cảnh báo chẩn đoán dễ nhầm</AlertTitle>
            <AlertDescription>
              Bệnh đốm vòng (Early Blight) dễ nhầm lẫn với Bệnh đốm mắt chim (Target Spot). Hãy kiểm
              tra kỹ các vòng đồng tâm trên mặt lá.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Chưa chắc chắn về kết quả</AlertTitle>
            <AlertDescription>
              Mô hình nhận diện với độ tin cậy thấp (dưới 70%). Bạn nên chụp lại ảnh cận cảnh hơn
              hoặc nhờ chuyên gia xác nhận.
            </AlertDescription>
          </Alert>

          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Quy trình phòng trừ sinh học IPM</AlertTitle>
            <AlertDescription>
              Ưu tiên cắt tỉa cành nhiễm bệnh và tiêu hủy trước khi quyết định dùng thuốc bảo vệ thực
              vật.
            </AlertDescription>
          </Alert>
        </div>
      </section>

      {/* 7. Ô NHẬP LIỆU (INPUT & TEXTAREA) */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">7. Ô Nhập liệu (Inputs)</h2>
          <p className="text-sm text-muted-foreground">
            Font size 16px và min-h 44px ngăn iOS tự động phóng to màn hình khi gõ.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ô Nhập văn bản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plant-name">Tên cây trồng hoặc giống cây</Label>
                <Input id="plant-name" placeholder="Ví dụ: Cà chua bi F1, Ớt chuông..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-input">Email liên hệ chuyên gia</Label>
                <Input id="email-input" type="email" placeholder="nongdan@example.com" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Khung Ghi chú (Textarea)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="symptom-notes">Mô tả triệu chứng bệnh ngoài vườn</Label>
                <Textarea
                  id="symptom-notes"
                  rows={4}
                  placeholder="Lá có đốm nâu từ tuần trước, xuất hiện nhiều ở tầng lá gốc..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 8. SKELETON & COMMON STATES */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">
            8. Trạng thái Tải, Rỗng & Lỗi (Common States)
          </h2>
          <p className="text-sm text-muted-foreground">
            Đảm bảo trải nghiệm liền mạch: Skeleton giữ khung hình, EmptyState và ErrorState thân
            thiện.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Trạng thái Rỗng (EmptyState)</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Chưa có ca chẩn đoán nào"
                description="Hãy chụp hoặc tải lên một bức ảnh lá cây bị bệnh để Lavi hỗ trợ bạn bắt bệnh ngay."
                actionText="Khám lá ngay"
                actionHref="/"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trạng thái Lỗi (ErrorState)</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorState
                title="Không thể tải dữ liệu"
                message="Hệ thống đang bận hoặc mất kết nối mạng. Vui lòng kiểm tra lại đường truyền."
                onRetry={() => toast.info('Đang kết nối lại máy chủ...')}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bộ xương Tải dữ liệu (PageSkeleton Demo)</CardTitle>
            <CardDescription>Thay thế spinner toàn trang</CardDescription>
          </CardHeader>
          <CardContent>
            <PageSkeleton variant="cards" />
          </CardContent>
        </Card>
      </section>

      {/* 9. TÀI SẢN THƯƠNG HIỆU & MASCOT LAVI */}
      <section className="space-y-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-2xl font-bold text-foreground">
            9. Tài sản Thương hiệu & Linh vật Lavi
          </h2>
          <p className="text-sm text-muted-foreground">
            Đã tối ưu chuẩn định dạng WebP, sẵn sàng cho cả Web và Android App.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="flex flex-col items-center justify-center p-4 text-center">
            <img src={logo256} alt="Logo 256" className="w-16 h-16 object-contain mb-2" />
            <span className="font-semibold text-xs">Logo 256px</span>
            <span className="text-[10px] text-muted-foreground">Hero / Header</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-4 text-center">
            <img src={logo64} alt="Logo 64" className="w-12 h-12 object-contain mb-2" />
            <span className="font-semibold text-xs">Logo 64px</span>
            <span className="text-[10px] text-muted-foreground">Navbar / Favicon</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-4 text-center">
            <img src={laviAvatar192} alt="Lavi Avatar 192" className="w-16 h-16 object-contain mb-2 rounded-full border border-border" />
            <span className="font-semibold text-xs">Avatar 192px</span>
            <span className="text-[10px] text-muted-foreground">Chat Bot Lavi</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-4 text-center">
            <img src={laviAvatar96} alt="Lavi Avatar 96" className="w-12 h-12 object-contain mb-2 rounded-full border border-border" />
            <span className="font-semibold text-xs">Avatar 96px</span>
            <span className="text-[10px] text-muted-foreground">User Menu / Mini</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-4 text-center">
            <img src={laviFull512} alt="Lavi Full 512" className="w-16 h-16 object-contain mb-2" />
            <span className="font-semibold text-xs">Lavi Full 512px</span>
            <span className="text-[10px] text-muted-foreground">Empty / 404 / 403</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-4 text-center">
            <img src={lavi3d720} alt="Lavi 3D 720" className="w-16 h-16 object-contain mb-2" />
            <span className="font-semibold text-xs">Lavi 3D 720px</span>
            <span className="text-[10px] text-muted-foreground">Hero / Banner</span>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default StyleguidePage;
