export const KOJI_DISPLAY_NAME_BY_DB_VALUE: Record<string, string> = {
  // DB値（現状） -> UI/AI表示（統一表記）
  'コンソメ麹': 'コンソメこうじ',
  '中華麹': '中華こうじ',
  '玉ねぎ麹': 'たまねぎこうじ',
  'たまねぎ麹': 'たまねぎこうじ',
};

/**
 * DBのkoji_typeなど（例: "中華麹"）を、UI/AIでの統一表記（例: "中華こうじ"）に変換する。
 * 未知の値はそのまま返す（ただし可能なら漢字の「麹」を「こうじ」に置換）。
 */
export function toKojiDisplayName(dbValue: string): string {
  if (!dbValue) return dbValue;
  const mapped = KOJI_DISPLAY_NAME_BY_DB_VALUE[dbValue];
  if (mapped) return mapped;
  return dbValue.replace(/麹/g, 'こうじ');
}



