import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  const login = async (phone, pin) => {
    const d = await api('/auth/login', { method: 'POST', body: { phone, pin } });
    setToken(d.token); setUser(d.user);
    return d.user;
  };
  const register = async (full_name, phone, pin) => {
    const d = await api('/auth/register', { method: 'POST', body: { full_name, phone, pin } });
    setToken(d.token); setUser(d.user);
    return d.user;
  };
  const logout = () => { setToken(null); setUser(null); };
  const updateUser = (patch) => setUser((u) => ({ ...u, ...patch }));

  return <AuthCtx.Provider value={{ user, ready, login, register, logout, updateUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
