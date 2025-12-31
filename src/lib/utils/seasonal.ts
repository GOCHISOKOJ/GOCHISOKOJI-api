import { toKojiDisplayName } from '@/lib/utils/koji';

// 日本の月別旬の食材データ（麹料理に合う野菜・魚介・肉のみ。果物・フルーツは除外）
const SEASONAL_INGREDIENTS: Record<number, string[]> = {
  1: [
    '白菜',
    '大根',
    '長ねぎ',
    'ほうれん草',
    '小松菜',
    '春菊',
    'れんこん',
    'ごぼう',
    '里芋',
    'かぶ',
    '水菜',
    'にんじん',
    '長芋',
    'ブリ',
    'タラ',
    'カキ',
    'サバ',
    'イワシ',
    'カニ',
    '鶏むね肉',
    '豚肩ロース',
    '豆腐',
    '油揚げ',
    'きのこ',
    '生姜',
    'にら',
  ],
  2: [
    'キャベツ',
    '白菜',
    'ブロッコリー',
    'カリフラワー',
    'ほうれん草',
    '小松菜',
    'ねぎ',
    'ごぼう',
    'れんこん',
    '大根',
    'かぶ',
    'にんじん',
    '菜の花',
    '長芋',
    'タラ',
    'ブリ',
    'サバ',
    'アサリ',
    '牡蠣',
    'ホタテ',
    '鶏もも肉',
    '豚バラ',
    '豆腐',
    '厚揚げ',
    '生姜',
    'にんにく',
  ],
  3: [
    '菜の花',
    '新玉ねぎ',
    '春キャベツ',
    'アスパラガス',
    'たけのこ',
    'せり',
    'ほうれん草',
    '小松菜',
    'ブロッコリー',
    'きのこ',
    'にんじん',
    'じゃがいも',
    'あさり',
    'しらす',
    'さわら',
    'サバ',
    '鯛',
    'エビ',
    'ホタテ',
    '鶏むね肉',
    '豚こま',
    '豆腐',
    '油揚げ',
    '生姜',
    'にら',
    '卵',
  ],
  4: [
    'たけのこ',
    '春キャベツ',
    '新玉ねぎ',
    'アスパラガス',
    'スナップえんどう',
    'そら豆',
    '新じゃが',
    'にんじん',
    'レタス',
    '水菜',
    'きのこ',
    'トマト',
    'カツオ',
    'アジ',
    'サワラ',
    'サバ',
    'しらす',
    'あさり',
    'ホタルイカ',
    'エビ',
    '鶏もも肉',
    '豚しゃぶ肉',
    '豆腐',
    '油揚げ',
    '生姜',
    'にんにく',
  ],
  5: [
    'そら豆',
    'スナップえんどう',
    '新ごぼう',
    '新玉ねぎ',
    '春キャベツ',
    'レタス',
    'トマト',
    'きゅうり',
    'にんじん',
    '新じゃが',
    'アスパラガス',
    '大葉',
    'アジ',
    'カツオ',
    'イワシ',
    'サバ',
    'しらす',
    'あさり',
    'エビ',
    'ホタテ',
    '鶏むね肉',
    '豚こま',
    '豆腐',
    '油揚げ',
    '生姜',
    'にんにく',
  ],
  6: [
    'トマト',
    'きゅうり',
    'なす',
    'ピーマン',
    'ズッキーニ',
    'オクラ',
    'とうもろこし',
    'いんげん',
    '大葉',
    'みょうが',
    '新じゃが',
    '玉ねぎ',
    'アジ',
    'イワシ',
    'サバ',
    'カツオ',
    'あさり',
    'ホタテ',
    'エビ',
    'いか',
    '鶏むね肉',
    '豚しゃぶ肉',
    '豆腐',
    '卵',
    '生姜',
    'にんにく',
  ],
  7: [
    'トマト',
    'きゅうり',
    'なす',
    'ピーマン',
    'ゴーヤ',
    'オクラ',
    'とうもろこし',
    '枝豆',
    '大葉',
    'みょうが',
    'しそ',
    'ねぎ',
    'アジ',
    'イワシ',
    'うなぎ',
    'カツオ',
    'たこ',
    'いか',
    'エビ',
    'ホタテ',
    '鶏むね肉',
    '豚バラ',
    '豆腐',
    '卵',
    '生姜',
    'にんにく',
  ],
  8: [
    'トマト',
    'きゅうり',
    'なす',
    'ピーマン',
    'ズッキーニ',
    'ゴーヤ',
    'オクラ',
    'とうもろこし',
    '枝豆',
    'みょうが',
    '大葉',
    'しょうが',
    'アジ',
    'イワシ',
    'さんま',
    'たこ',
    'いか',
    'エビ',
    'ホタテ',
    'マグロ',
    '鶏むね肉',
    '豚しゃぶ肉',
    '豆腐',
    '卵',
    'にんにく',
  ],
  9: [
    'さつまいも',
    'かぼちゃ',
    '里芋',
    'れんこん',
    'きのこ',
    'なす',
    'ピーマン',
    'にんじん',
    'ねぎ',
    'ごぼう',
    '生姜',
    '大葉',
    'サンマ',
    '鮭',
    'サバ',
    'アジ',
    'イワシ',
    'たこ',
    'いか',
    'ホタテ',
    '鶏もも肉',
    '豚バラ',
    '豆腐',
    '油揚げ',
    'にんにく',
    '卵',
  ],
  10: [
    'きのこ',
    'さつまいも',
    'かぼちゃ',
    'れんこん',
    '里芋',
    'ごぼう',
    'にんじん',
    'ねぎ',
    '白菜',
    '大根',
    '生姜',
    '春菊',
    '鮭',
    'サンマ',
    'サバ',
    'イワシ',
    'カツオ',
    'ホタテ',
    '牡蠣',
    'エビ',
    '鶏もも肉',
    '豚肩ロース',
    '豆腐',
    '油揚げ',
    '卵',
    'にんにく',
  ],
  11: [
    'れんこん',
    '里芋',
    '白菜',
    '大根',
    'ねぎ',
    'ほうれん草',
    '小松菜',
    '春菊',
    'ごぼう',
    'かぶ',
    'にんじん',
    'きのこ',
    'サバ',
    '鮭',
    'ブリ',
    'タラ',
    'イワシ',
    'カツオ',
    '牡蠣',
    'ホタテ',
    '鶏むね肉',
    '豚バラ',
    '豆腐',
    '油揚げ',
    '生姜',
    'にんにく',
  ],
  12: [
    '白菜',
    '大根',
    'ねぎ',
    '長ねぎ',
    'ほうれん草',
    '小松菜',
    '春菊',
    'れんこん',
    'ごぼう',
    '里芋',
    'かぶ',
    'にんじん',
    '長芋',
    '生姜',
    'ブリ',
    'タラ',
    '鮭',
    'サバ',
    'イワシ',
    '牡蠣',
    'ホタテ',
    'エビ',
    'カニ',
    '鶏もも肉',
    '豚バラ',
    '豆腐',
    '油揚げ',
  ],
};

export function getJstHour(now: Date = new Date()): number {
  // サーバ/クライアントでブレないように「UTC+9」で手計算する
  const h = (now.getUTCHours() + 9) % 24;
  return h < 0 ? h + 24 : h;
}

/**
 * 月ごとの旬食材候補を取得する（API側でAIに選ばせるための候補）
 */
export function getSeasonalIngredientCandidatesForMonth(month: number): string[] {
  return SEASONAL_INGREDIENTS[month] || [];
}

function pickRandomDistinct<T>(arr: T[], count: number): T[] {
  const a = [...arr];
  // Fisher–Yates shuffle
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, count));
}

/**
 * 現在の月の旬食材からランダムに選ぶ（リロードごとに変わる）
 */
export function pickSeasonalIngredientsForNow(count: number = 3): { month: number; pickedIngredients: string[] } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const ingredients = getSeasonalIngredientCandidatesForMonth(month);
  return { month, pickedIngredients: pickRandomDistinct(ingredients, count) };
}

/**
 * 現在の日時に基づいて、AIの初期メッセージを生成する（季節の話のみ）
 * 具体的な料理名は言わない（麹選択後の「例」に任せる）
 */
export function generateSeasonalGreeting(args?: { pickedIngredients?: string[]; now?: Date }): string {
  const now = args?.now ?? new Date();
  const month = now.getMonth() + 1; // 0-11 -> 1-12

  // 日本時間で「10:00」を境に切り替える（10時前=おはよう、10時以降=こんにちは）
  const hourJst = getJstHour(now);
  const greeting = hourJst < 10 ? 'おはよう！' : 'こんにちは！';

  const pickedIngredients =
    Array.isArray(args?.pickedIngredients) && args!.pickedIngredients!.length > 0
      ? args!.pickedIngredients!.slice(0, 3)
      : pickSeasonalIngredientsForNow(3).pickedIngredients;

  const ingredientsLine =
    pickedIngredients.length > 0
      ? `${month}月の旬: ${pickedIngredients.join('・')} とかがおすすめ😋`
      : `${month}月の旬を一緒に探そう！😋`;

  // 指定フォーマット（空行あり）
  // 1行目: 挨拶
  // 2行目: 自己紹介
  // 3行目: 空行
  // 4行目: 旬
  // 5行目: 空行
  // 6行目: 質問
  // 7行目: 誘導
  return `${greeting}\nこうじのコウちゃんだよ！\n\n${ingredientsLine}\n\n今日はどんな料理を作りたい？\n下の「例」や「使うこうじ」を選んでね！`;
}

// 麹タイプ × 季節の料理例データ
type SeasonalRecipe = { title: string; description: string };
type KojiRecipes = Record<string, SeasonalRecipe>;
const SEASONAL_RECIPES: Record<number, KojiRecipes> = {
  1: {
    '玉ねぎ麹': { title: '白菜と豚バラの蒸し煮', description: '玉ねぎ麹で豚バラを漬け込み、白菜と重ねて蒸すだけ。旨味たっぷりの冬の一品。' },
    '中華麹': { title: '白菜の中華うま煮', description: '白菜を中華麹で炒め煮に。とろっとした食感がたまらない！' },
    'コンソメ麹': { title: '大根とベーコンのポトフ', description: '大根をコンソメ麹でじっくり煮込む。体が温まる冬の定番。' },
  },
  2: {
    '玉ねぎ麹': { title: 'キャベツのコールスロー', description: '玉ねぎ麹をドレッシング代わりに。甘みが増して子どもも喜ぶ味。' },
    '中華麹': { title: 'タラの中華蒸し', description: 'タラに中華麹をのせてレンジで蒸すだけ。ふっくら仕上がる！' },
    'コンソメ麹': { title: 'カリフラワーのポタージュ', description: 'カリフラワーをコンソメ麹で煮てブレンダーにかけるだけ。クリーミー！' },
  },
  3: {
    '玉ねぎ麹': { title: '新玉ねぎのマリネ', description: '新玉ねぎを薄切りにして玉ねぎ麹で和えるだけ。春の味覚。' },
    '中華麹': { title: 'アサリの中華酒蒸し', description: 'アサリと中華麹で酒蒸しに。貝の旨味が倍増！' },
    'コンソメ麹': { title: '菜の花のスープ', description: '菜の花をコンソメ麹スープで。ほろ苦さが春を感じさせる。' },
  },
  4: {
    '玉ねぎ麹': { title: 'たけのこの土佐煮風', description: 'たけのこを玉ねぎ麹で煮る。かつお節をのせて完成。' },
    '中華麹': { title: 'アスパラの中華炒め', description: 'アスパラを中華麹でさっと炒める。シャキシャキ食感がたまらない。' },
    'コンソメ麹': { title: '春キャベツのスープ', description: '春キャベツをコンソメ麹で煮込む。甘くてやさしい味わい。' },
  },
  5: {
    '玉ねぎ麹': { title: 'そら豆の玉ねぎ麹和え', description: 'そら豆を茹でて玉ねぎ麹で和えるだけ。おつまみにも最高。' },
    '中華麹': { title: 'アジの中華南蛮', description: 'アジを揚げて中華麹ダレをかける。ご飯が進む！' },
    'コンソメ麹': { title: 'レタスのスープ', description: 'レタスをさっとコンソメ麹スープに。シャキッと食感を残して。' },
  },
  6: {
    '玉ねぎ麹': { title: 'トマトと玉ねぎ麹のサラダ', description: 'トマトをスライスして玉ねぎ麹をかけるだけ。夏の前菜に。' },
    '中華麹': { title: 'ナスの中華炒め', description: 'ナスを中華麹で炒める。とろとろジューシー！' },
    'コンソメ麹': { title: 'ピーマンの肉詰めスープ煮', description: 'ピーマンの肉詰めをコンソメ麹で煮込む。ジューシーに仕上がる。' },
  },
  7: {
    '玉ねぎ麹': { title: 'きゅうりの浅漬け', description: 'きゅうりを玉ねぎ麹で漬けるだけ。さっぱり夏の味。' },
    '中華麹': { title: 'トマトと卵の中華炒め', description: 'トマトと卵を中華麹で炒める。ふわとろで美味しい！' },
    'コンソメ麹': { title: 'とうもろこしのスープ', description: 'とうもろこしをコンソメ麹で煮てポタージュに。甘くて幸せ。' },
  },
  8: {
    '玉ねぎ麹': { title: 'ゴーヤチャンプルー', description: 'ゴーヤを玉ねぎ麹で炒める。苦味がマイルドに！' },
    '中華麹': { title: 'オクラの中華和え', description: 'オクラを茹でて中華麹で和える。ネバネバが夏バテ防止に。' },
    'コンソメ麹': { title: 'ズッキーニのグリル', description: 'ズッキーニをコンソメ麹でグリル。シンプルだけど絶品。' },
  },
  9: {
    '玉ねぎ麹': { title: 'さつまいもの甘煮', description: 'さつまいもを玉ねぎ麹で煮る。自然な甘さが引き立つ。' },
    '中華麹': { title: 'サンマの中華風', description: 'サンマに中華麹を塗って焼く。香ばしくてご飯に合う！' },
    'コンソメ麹': { title: 'かぼちゃのスープ', description: 'かぼちゃをコンソメ麹で煮てポタージュに。秋の定番。' },
  },
  10: {
    '玉ねぎ麹': { title: 'きのこの炊き込みご飯', description: 'きのこと玉ねぎ麹で炊き込みご飯。香りが最高！' },
    '中華麹': { title: '鮭の中華照り焼き', description: '鮭に中華麹を塗って焼く。コクのある味わい。' },
    'コンソメ麹': { title: 'さつまいものポタージュ', description: 'さつまいもをコンソメ麹で煮てポタージュに。ほっこり甘い。' },
  },
  11: {
    '玉ねぎ麹': { title: '里芋の煮っころがし', description: '里芋を玉ねぎ麹で煮る。ほくほくで味が染みる！' },
    '中華麹': { title: 'サバの中華煮', description: 'サバを中華麹で煮込む。臭みが消えて食べやすい。' },
    'コンソメ麹': { title: 'れんこんのスープ', description: 'れんこんをコンソメ麹スープに。シャキシャキ食感が楽しい。' },
  },
  12: {
    '玉ねぎ麹': { title: '白菜と豚肉のミルフィーユ鍋', description: '白菜と豚肉を重ねて玉ねぎ麹で煮込む。見た目も華やか。' },
    '中華麹': { title: '大根の中華煮', description: '大根を中華麹でじっくり煮込む。味がしみて絶品！' },
    'コンソメ麹': { title: '冬野菜のポトフ', description: '大根、白菜、ネギをコンソメ麹で煮込む。体ぽかぽか。' },
  },
};

/**
 * 選択中の麹タイプと現在の月に基づいて、料理の例を取得する
 * @param kojiType 選択中の麹の種類（例：中華麹）
 * @returns 料理例のオブジェクト { title, description } または null
 */
export function getSeasonalExample(kojiType: string): { title: string; description: string } | null {
  const month = new Date().getMonth() + 1;
  const recipes = SEASONAL_RECIPES[month];
  if (!recipes) return null;
  return recipes[kojiType] || null;
}

/**
 * 選択中の麹タイプと現在の月に基づいて、「例」として表示するテキストを生成する
 * @param kojiType 選択中の麹の種類（例：中華麹）
 * @returns 「例」として表示するテキスト
 */
export function getSeasonalExampleText(kojiType: string): string {
  const displayKoji = toKojiDisplayName(kojiType);
  const example = getSeasonalExample(kojiType);
  if (!example) {
    return `${displayKoji}を使った料理を一緒に考えよう！`;
  }
  return `${displayKoji}で${example.title}。${example.description}`;
}

