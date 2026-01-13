/**
 * 日本食品標準成分表（八訂）ベースの栄養データベース
 * 参考: https://www.mext.go.jp/a_menu/syokuhinseibun/
 * 
 * 値は100gあたりのカロリー(kcal)と塩分(g)
 */

export interface NutritionData {
  calories: number; // kcal per 100g
  salt: number;     // g per 100g
  category: 'protein' | 'vegetable' | 'other';
}

// 日本食品標準成分表ベースのデータ（100gあたり）
export const NUTRITION_DATABASE: Record<string, NutritionData> = {
  // === 肉類 ===
  '豚バラ': { calories: 386, salt: 0.1, category: 'protein' },
  '豚バラ肉': { calories: 386, salt: 0.1, category: 'protein' },
  '豚こま': { calories: 236, salt: 0.1, category: 'protein' },
  '豚こま肉': { calories: 236, salt: 0.1, category: 'protein' },
  '豚肉': { calories: 263, salt: 0.1, category: 'protein' },
  '鶏もも肉': { calories: 200, salt: 0.1, category: 'protein' },
  '鶏もも': { calories: 200, salt: 0.1, category: 'protein' },
  '鶏むね肉': { calories: 108, salt: 0.1, category: 'protein' },
  '鶏むね': { calories: 108, salt: 0.1, category: 'protein' },
  '鶏胸肉': { calories: 108, salt: 0.1, category: 'protein' },
  '鶏肉': { calories: 200, salt: 0.1, category: 'protein' },
  '牛肉': { calories: 259, salt: 0.1, category: 'protein' },
  'ひき肉': { calories: 224, salt: 0.1, category: 'protein' },
  '合いびき肉': { calories: 259, salt: 0.1, category: 'protein' },
  '豚ひき肉': { calories: 221, salt: 0.1, category: 'protein' },
  '鶏ひき肉': { calories: 166, salt: 0.1, category: 'protein' },
  'ベーコン': { calories: 405, salt: 2.0, category: 'protein' },
  'ウインナー': { calories: 321, salt: 1.9, category: 'protein' },
  'ソーセージ': { calories: 321, salt: 1.9, category: 'protein' },
  'ハム': { calories: 196, salt: 2.5, category: 'protein' },

  // === 魚介類 ===
  '鮭': { calories: 133, salt: 0.1, category: 'protein' },
  'サーモン': { calories: 133, salt: 0.1, category: 'protein' },
  'さば': { calories: 202, salt: 0.3, category: 'protein' },
  'ぶり': { calories: 257, salt: 0.1, category: 'protein' },
  'たら': { calories: 77, salt: 0.3, category: 'protein' },
  'エビ': { calories: 83, salt: 0.4, category: 'protein' },
  'えび': { calories: 83, salt: 0.4, category: 'protein' },
  'イカ': { calories: 88, salt: 0.5, category: 'protein' },
  'いか': { calories: 88, salt: 0.5, category: 'protein' },
  'ツナ': { calories: 97, salt: 0.8, category: 'protein' },
  'ツナ缶': { calories: 97, salt: 0.8, category: 'protein' },
  'しらす': { calories: 113, salt: 4.1, category: 'protein' },
  'ちりめんじゃこ': { calories: 206, salt: 6.6, category: 'protein' },

  // === 卵・大豆製品 ===
  '卵': { calories: 151, salt: 0.4, category: 'protein' },
  'たまご': { calories: 151, salt: 0.4, category: 'protein' },
  '豆腐': { calories: 56, salt: 0, category: 'protein' },
  '木綿豆腐': { calories: 72, salt: 0, category: 'protein' },
  '絹ごし豆腐': { calories: 56, salt: 0, category: 'protein' },
  '油揚げ': { calories: 386, salt: 0, category: 'protein' },
  '厚揚げ': { calories: 150, salt: 0, category: 'protein' },
  '納豆': { calories: 200, salt: 0, category: 'protein' },

  // === 葉物野菜 ===
  'キャベツ': { calories: 23, salt: 0, category: 'vegetable' },
  'レタス': { calories: 12, salt: 0, category: 'vegetable' },
  '白菜': { calories: 14, salt: 0, category: 'vegetable' },
  'はくさい': { calories: 14, salt: 0, category: 'vegetable' },
  'ほうれん草': { calories: 20, salt: 0, category: 'vegetable' },
  'ほうれんそう': { calories: 20, salt: 0, category: 'vegetable' },
  '小松菜': { calories: 14, salt: 0, category: 'vegetable' },
  'こまつな': { calories: 14, salt: 0, category: 'vegetable' },
  'チンゲン菜': { calories: 9, salt: 0, category: 'vegetable' },
  'チンゲンサイ': { calories: 9, salt: 0, category: 'vegetable' },
  '水菜': { calories: 23, salt: 0, category: 'vegetable' },
  'ニラ': { calories: 21, salt: 0, category: 'vegetable' },
  'にら': { calories: 21, salt: 0, category: 'vegetable' },
  '大葉': { calories: 37, salt: 0, category: 'vegetable' },
  'しそ': { calories: 37, salt: 0, category: 'vegetable' },

  // === 根菜・芋類 ===
  '大根': { calories: 18, salt: 0, category: 'vegetable' },
  'だいこん': { calories: 18, salt: 0, category: 'vegetable' },
  'にんじん': { calories: 39, salt: 0, category: 'vegetable' },
  '人参': { calories: 39, salt: 0, category: 'vegetable' },
  'ごぼう': { calories: 65, salt: 0, category: 'vegetable' },
  'れんこん': { calories: 66, salt: 0, category: 'vegetable' },
  'じゃがいも': { calories: 76, salt: 0, category: 'vegetable' },
  'さつまいも': { calories: 134, salt: 0, category: 'vegetable' },
  '里芋': { calories: 58, salt: 0, category: 'vegetable' },
  'さといも': { calories: 58, salt: 0, category: 'vegetable' },

  // === その他野菜 ===
  '玉ねぎ': { calories: 37, salt: 0, category: 'vegetable' },
  'たまねぎ': { calories: 37, salt: 0, category: 'vegetable' },
  '長ねぎ': { calories: 28, salt: 0, category: 'vegetable' },
  'ながねぎ': { calories: 28, salt: 0, category: 'vegetable' },
  'ねぎ': { calories: 28, salt: 0, category: 'vegetable' },
  'もやし': { calories: 14, salt: 0, category: 'vegetable' },
  'きゅうり': { calories: 14, salt: 0, category: 'vegetable' },
  'なす': { calories: 22, salt: 0, category: 'vegetable' },
  'ナス': { calories: 22, salt: 0, category: 'vegetable' },
  'ピーマン': { calories: 22, salt: 0, category: 'vegetable' },
  'パプリカ': { calories: 30, salt: 0, category: 'vegetable' },
  'トマト': { calories: 19, salt: 0, category: 'vegetable' },
  'ミニトマト': { calories: 29, salt: 0, category: 'vegetable' },
  'ブロッコリー': { calories: 33, salt: 0, category: 'vegetable' },
  'カリフラワー': { calories: 27, salt: 0, category: 'vegetable' },
  'アスパラ': { calories: 22, salt: 0, category: 'vegetable' },
  'アスパラガス': { calories: 22, salt: 0, category: 'vegetable' },
  'オクラ': { calories: 30, salt: 0, category: 'vegetable' },
  'かぼちゃ': { calories: 91, salt: 0, category: 'vegetable' },
  'ズッキーニ': { calories: 14, salt: 0, category: 'vegetable' },
  'セロリ': { calories: 15, salt: 0, category: 'vegetable' },

  // === きのこ類 ===
  'しめじ': { calories: 18, salt: 0, category: 'vegetable' },
  'えのき': { calories: 22, salt: 0, category: 'vegetable' },
  'エリンギ': { calories: 24, salt: 0, category: 'vegetable' },
  'まいたけ': { calories: 16, salt: 0, category: 'vegetable' },
  'しいたけ': { calories: 18, salt: 0, category: 'vegetable' },
  'きくらげ': { calories: 13, salt: 0, category: 'vegetable' },
  'なめこ': { calories: 15, salt: 0, category: 'vegetable' },
  'きのこ': { calories: 18, salt: 0, category: 'vegetable' },
  'マッシュルーム': { calories: 11, salt: 0, category: 'vegetable' },

  // === 海藻類 ===
  'わかめ': { calories: 16, salt: 9.9, category: 'vegetable' },
  'ワカメ': { calories: 16, salt: 9.9, category: 'vegetable' },
  '昆布': { calories: 145, salt: 7.1, category: 'vegetable' },
  'のり': { calories: 188, salt: 1.3, category: 'vegetable' },
  'ひじき': { calories: 149, salt: 4.7, category: 'vegetable' },

  // === 調味料（麹）===
  '旨塩風こうじ調味料': { calories: 80, salt: 5.0, category: 'other' },
  '中華風こうじ調味料': { calories: 90, salt: 6.0, category: 'other' },
  'コンソメ風こうじ調味料': { calories: 85, salt: 5.5, category: 'other' },
  'たまねぎ麹': { calories: 80, salt: 5.0, category: 'other' },
  '中華麹': { calories: 90, salt: 6.0, category: 'other' },
  'コンソメ麹': { calories: 85, salt: 5.5, category: 'other' },
  '塩麹': { calories: 153, salt: 12.8, category: 'other' },

  // === その他調味料 ===
  'ごま油': { calories: 921, salt: 0, category: 'other' },
  'オリーブオイル': { calories: 921, salt: 0, category: 'other' },
  '油': { calories: 921, salt: 0, category: 'other' },
  'サラダ油': { calories: 921, salt: 0, category: 'other' },
  'バター': { calories: 745, salt: 1.5, category: 'other' },
  'マヨネーズ': { calories: 703, salt: 1.8, category: 'other' },
  '味噌': { calories: 192, salt: 12.4, category: 'other' },
  'みそ': { calories: 192, salt: 12.4, category: 'other' },
  '醤油': { calories: 71, salt: 14.5, category: 'other' },
  'しょうゆ': { calories: 71, salt: 14.5, category: 'other' },
  '酢': { calories: 25, salt: 0, category: 'other' },
  'みりん': { calories: 241, salt: 0, category: 'other' },
  '砂糖': { calories: 384, salt: 0, category: 'other' },
  'ごま': { calories: 599, salt: 0, category: 'other' },
};

// 標準的な1人前の使用量（g）
export const STANDARD_PORTIONS: Record<string, number> = {
  // === 肉類 ===
  '豚バラ': 80,
  '豚バラ肉': 80,
  '豚こま': 80,
  '豚こま肉': 80,
  '豚肉': 80,
  '鶏もも肉': 100,
  '鶏もも': 100,
  '鶏むね肉': 100,
  '鶏むね': 100,
  '鶏胸肉': 100,
  '鶏肉': 100,
  '牛肉': 80,
  'ひき肉': 80,
  '合いびき肉': 80,
  '豚ひき肉': 80,
  '鶏ひき肉': 80,
  'ベーコン': 30,
  'ウインナー': 50,
  'ソーセージ': 50,
  'ハム': 30,

  // === 魚介類 ===
  '鮭': 80,
  'サーモン': 80,
  'さば': 80,
  'ぶり': 80,
  'たら': 80,
  'エビ': 60,
  'えび': 60,
  'イカ': 60,
  'いか': 60,
  'ツナ': 40,
  'ツナ缶': 40,
  'しらす': 15,
  'ちりめんじゃこ': 10,

  // === 卵・大豆製品 ===
  '卵': 60, // 1個
  'たまご': 60,
  '豆腐': 150, // 半丁
  '木綿豆腐': 150,
  '絹ごし豆腐': 150,
  '油揚げ': 30, // 1枚
  '厚揚げ': 100,
  '納豆': 50, // 1パック

  // === 葉物野菜 ===
  'キャベツ': 80,
  'レタス': 50,
  '白菜': 100,
  'はくさい': 100,
  'ほうれん草': 80,
  'ほうれんそう': 80,
  '小松菜': 80,
  'こまつな': 80,
  'チンゲン菜': 80,
  'チンゲンサイ': 80,
  '水菜': 50,
  'ニラ': 50,
  'にら': 50,
  '大葉': 5,
  'しそ': 5,

  // === 根菜・芋類 ===
  '大根': 100,
  'だいこん': 100,
  'にんじん': 50,
  '人参': 50,
  'ごぼう': 50,
  'れんこん': 60,
  'じゃがいも': 100,
  'さつまいも': 100,
  '里芋': 80,
  'さといも': 80,

  // === その他野菜 ===
  '玉ねぎ': 80,
  'たまねぎ': 80,
  '長ねぎ': 50,
  'ながねぎ': 50,
  'ねぎ': 30,
  'もやし': 100,
  'きゅうり': 80,
  'なす': 80,
  'ナス': 80,
  'ピーマン': 40,
  'パプリカ': 50,
  'トマト': 100,
  'ミニトマト': 50,
  'ブロッコリー': 80,
  'カリフラワー': 80,
  'アスパラ': 50,
  'アスパラガス': 50,
  'オクラ': 40,
  'かぼちゃ': 80,
  'ズッキーニ': 80,
  'セロリ': 50,

  // === きのこ類 ===
  'しめじ': 50,
  'えのき': 50,
  'エリンギ': 50,
  'まいたけ': 50,
  'しいたけ': 30,
  'きくらげ': 10,
  'なめこ': 40,
  'きのこ': 50,
  'マッシュルーム': 30,

  // === 海藻類 ===
  'わかめ': 5, // 乾燥
  'ワカメ': 5,
  '昆布': 5,
  'のり': 3,
  'ひじき': 5,

  // === 調味料（大さじ1 = 約15g）===
  '旨塩風こうじ調味料': 22, // 大さじ1.5
  '中華風こうじ調味料': 22,
  'コンソメ風こうじ調味料': 22,
  'たまねぎ麹': 22,
  '中華麹': 22,
  'コンソメ麹': 22,
  '塩麹': 15,
  'ごま油': 6, // 小さじ1.5
  'オリーブオイル': 6,
  '油': 12, // 大さじ1
  'サラダ油': 12,
  'バター': 10,
  'マヨネーズ': 12,
  '味噌': 18, // 大さじ1
  'みそ': 18,
  '醤油': 9, // 大さじ0.5
  'しょうゆ': 9,
  '酢': 15,
  'みりん': 18,
  '砂糖': 9,
  'ごま': 3,
};

// 調理法による調理時間（分）
export const COOKING_TIME_BY_METHOD: Record<string, number> = {
  '和え': 5,
  '和え物': 5,
  'ナムル': 7,
  'サラダ': 5,
  'マリネ': 10,
  '炒め': 10,
  '炒め物': 10,
  '焼き': 15,
  '焼く': 15,
  '煮': 20,
  '煮物': 20,
  '煮込み': 25,
  'スープ': 15,
  '汁物': 10,
  'みそ汁': 10,
  '味噌汁': 10,
  '鍋': 20,
  '蒸し': 15,
  '蒸す': 15,
  '揚げ': 15,
  '揚げ物': 15,
};

// 調理法による油使用量の追加カロリー
export const OIL_CALORIES_BY_METHOD: Record<string, number> = {
  '和え': 20,     // ごま油少々
  'ナムル': 45,   // ごま油多め
  'サラダ': 30,   // ドレッシング
  'マリネ': 25,   // オリーブオイル
  '炒め': 80,     // サラダ油大さじ1弱
  '焼き': 50,     // 油少々
  '煮': 10,       // ほぼなし
  'スープ': 15,   // 少々
  'みそ汁': 5,    // ほぼなし
  '鍋': 10,       // ほぼなし
  '蒸し': 5,      // ほぼなし
  '揚げ': 150,    // 吸油量
};
