import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { sanitizeInternalRedirect } from '@/lib/safe-redirect';
import { getErrorMessage, getValidationErrors } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import lavi3dImg from '@/assets/brand/lavi-3d-happy-720.webp';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const nextUrl = sanitizeInternalRedirect(searchParams.get('next'), '/');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Nếu người dùng đã đăng nhập, tự động chuyển về trang đích
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(nextUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, nextUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (!email.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ email.');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(email.trim(), password);
      toast.success(`Chào mừng bạn trở lại, ${user.fullName}!`, {
        icon: <CheckCircle2 className="h-5 w-5 text-status-ok" />,
      });
      navigate(nextUrl, { replace: true });
    } catch (err: unknown) {
      const vErrors = getValidationErrors(err);
      if (Object.keys(vErrors).length > 0) {
        setFieldErrors(vErrors);
      }
      const msg = getErrorMessage(err);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Card className="w-full border border-white/40 bg-card/95 shadow-2xl backdrop-blur-md">
        <CardHeader className="text-center space-y-2">
          <img
            src={lavi3dImg}
            alt=""
            className="mx-auto h-20 w-20 object-contain lg:hidden"
          />
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Chào mừng quay lại
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Đăng nhập để xem lịch sử khám và đơn hàng của bạn
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nongdan@lavitree.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading}
                required
                className={fieldErrors.Email || fieldErrors.email ? 'border-destructive' : ''}
              />
              {(fieldErrors.Email || fieldErrors.email) && (
                <p className="text-xs text-destructive">
                  {(fieldErrors.Email || fieldErrors.email)?.[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Mật khẩu
                </Label>
              </div>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
                required
                className={fieldErrors.Password || fieldErrors.password ? 'border-destructive' : ''}
              />
              {(fieldErrors.Password || fieldErrors.password) && (
                <p className="text-xs text-destructive">
                  {(fieldErrors.Password || fieldErrors.password)?.[0]}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary-hover text-white font-medium h-11"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang đăng nhập...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <LogIn className="h-4 w-4" />
                  <span>Đăng nhập</span>
                </div>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Chưa có tài khoản?{' '}
              <Link
                to={`/register?next=${encodeURIComponent(nextUrl)}`}
                className="font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Đăng ký ngay <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
