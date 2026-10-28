import { createContext, useContext, useEffect, useState } from 'react';
import { store } from './api';

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => store.get('ettaka.theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store.set('ettaka.theme', theme);
  }, [theme]);
  return <ThemeCtx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

// Page header (title + subtitle) shown in the top bar.
const PageCtx = createContext({ set: () => {} });
export function PageProvider({ children }) {
  const [page, set] = useState({ title: '', sub: '' });
  return <PageCtx.Provider value={{ page, set }}>{children}</PageCtx.Provider>;
}
export const usePageMeta = () => useContext(PageCtx).page;
export function usePage(title, sub) {
  const { set } = useContext(PageCtx);
  useEffect(() => {
    set({ title, sub });
    document.title = title ? `${title} · Ettaka` : 'Ettaka · Land Rights Evidence';
  }, [title, sub, set]);
}
