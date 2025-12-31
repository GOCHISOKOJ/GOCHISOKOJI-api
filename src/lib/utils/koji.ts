export const KOJI_DISPLAY_NAME_BY_DB_VALUE: Record<string, string> = {
  // DB値（現状） -> UI/AI表示（新名称）
  'コンソメ麹': 'コンソメ風こうじ調味料',
  'コンソメこうじ': 'コンソメ風こうじ調味料',
  '中華麹': '中華風こうじ調味料',
  '中華こうじ': '中華風こうじ調味料',
  '玉ねぎ麹': '旨塩風こうじ調味料',
  'たまねぎ麹': '旨塩風こうじ調味料',
  'たまねぎこうじ': '旨塩風こうじ調味料',
};

/**
 * DBのkoji_typeなど（例: "中華麹"）を、UI/AIでの統一表記（例: "中華風こうじ調味料"）に変換する。
 * 未知の値はそのまま返す。
 */
export function toKojiDisplayName(dbValue: string): string {
  if (!dbValue) return dbValue;
  const mapped = KOJI_DISPLAY_NAME_BY_DB_VALUE[dbValue];
  if (mapped) return mapped;
  return dbValue;
}

// 短縮表示名（UIのフィルターボタン等で使用）
export const KOJI_SHORT_LABELS: Record<string, string> = {
  'たまねぎ': '旨塩風',
  '中華': '中華風',
  'コンソメ': 'コンソメ風',
};



