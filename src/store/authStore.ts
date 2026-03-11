import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';

interface AuthState {
  token: string | null;
  role: 'ADMIN' | 'CLIENT' | 'STAFF' | null;
  username: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const storedToken = localStorage.getItem('app_token');
  let initialRole = null;
  let initialUsername = null;

  if (storedToken) {
    try {
      const decoded: any = jwtDecode(storedToken);
      initialRole = decoded.role;
      initialUsername = decoded.sub;
    } catch {
      localStorage.removeItem('app_token');
    }
  }

  return {
    token: storedToken,
    role: initialRole,
    username: initialUsername,
    setToken: (token: string) => {
      localStorage.setItem('app_token', token);
      const decoded: any = jwtDecode(token);
      set({ token, role: decoded.role, username: decoded.sub });
    },
    logout: () => {
      localStorage.removeItem('app_token');
      set({ token: null, role: null, username: null });
    }
  };
});
