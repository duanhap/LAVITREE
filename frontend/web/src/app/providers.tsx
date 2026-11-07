import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';

// Khởi tạo QueryClient với cấu hình mặc định thân thiện cho mạng đồng ruộng
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 phút
      retry: 1, // thử lại 1 lần nếu gặp lỗi mạng
      refetchOnWindowFocus: false,
    },
  },
});

import { AuthProvider } from '@/context/AuthContext';

export interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default AppProviders;
