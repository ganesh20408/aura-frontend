import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DARK_PALETTE = {
  mode: 'dark',
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceElevated: '#172033',
  card: '#0f172a',
  border: '#334155',
  primary: '#2563eb',
  primarySoft: 'rgba(37, 99, 235, 0.18)',
  accent: '#60a5fa',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444'
};

const LIGHT_PALETTE = {
  mode: 'light',
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceElevated: '#f1f5f9',
  card: '#f8fafc',
  border: '#cbd5e1',
  primary: '#2563eb',
  primarySoft: 'rgba(37, 99, 235, 0.10)',
  accent: '#1d4ed8',
  text: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  success: '#16a34a',
  warning: '#ca8a04',
  danger: '#dc2626'
};

const ThemeContext = createContext({
  theme: DARK_PALETTE,
  isDark: true,
  toggleTheme: () => {}
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme !== 'light');

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('@aura_theme_mode');
      if (saved === 'light' || saved === 'dark') {
        setIsDark(saved === 'dark');
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('@aura_theme_mode', next ? 'dark' : 'light');
  };

  const value = useMemo(() => ({
    theme: isDark ? DARK_PALETTE : LIGHT_PALETTE,
    isDark,
    toggleTheme
  }), [isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAuraTheme = () => useContext(ThemeContext);