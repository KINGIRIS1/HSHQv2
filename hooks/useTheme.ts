import { useEffect } from 'react';

export type Theme = 'light';

export const useTheme = () => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    try {
      localStorage.removeItem('app_theme');
    } catch (e) {}
  }, []);

  const toggleTheme = () => {};

  return { theme: 'light' as Theme, setTheme: () => {}, toggleTheme };
};
