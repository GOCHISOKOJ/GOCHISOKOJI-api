'use client';

import { useEffect } from 'react';

export function FontSizeInitializer() {
  useEffect(() => {
    // localStorageから文字サイズ設定を読み込んで適用
    const fontSize = localStorage.getItem('fontSize');
    if (fontSize && ['small', 'medium', 'large'].includes(fontSize)) {
      document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
      document.documentElement.classList.add(`font-${fontSize}`);
    }
  }, []);

  return null;
}


