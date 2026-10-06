import React, { useEffect, useState } from 'react';

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('vi-theme') || 'dark';
    setTheme(saved as 'dark' | 'light');
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('vi-theme', next);
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-between w-14 h-7 px-1 rounded-full cursor-pointer transition-colors border border-[var(--theme-btn-bdr)] bg-[var(--theme-btn-bg)] hover:border-[var(--rim-hi)]"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      aria-label="Toggle theme"
    >
      <span className={`text-xs transition-opacity ${theme === 'dark' ? 'opacity-100' : 'opacity-35'}`}>
        ☀️
      </span>
      <span className={`text-xs transition-opacity ${theme === 'light' ? 'opacity-100' : 'opacity-35'}`}>
        🌙
      </span>
      <div
        className={`absolute top-0.5 w-6 h-6 rounded-full transition-transform duration-200 shadow-sm ${
          theme === 'dark'
            ? 'left-0.5 bg-gradient-to-br from-[var(--gold-lt)] to-[var(--gold-pale)]'
            : 'translate-x-7 bg-gradient-to-br from-[var(--violet)] to-[var(--rose)]'
        }`}
      />
    </button>
  );
};
