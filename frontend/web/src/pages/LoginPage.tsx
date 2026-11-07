import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { sanitizeInternalRedirect } from '@/app/RequireRole';
import { getErrorMessage, getValidationErrors } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sprout, LogIn, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-sm border border-border">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Sprout className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Đăng nhập Lavitree
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Hệ thống Chẩn đoán Bệnh cây & Trợ lý Nông nghiệp Thông minh
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
              <Input
                id="password"
                type="password"
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
              Chưa có tài khoản Nông dân?{' '}
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
