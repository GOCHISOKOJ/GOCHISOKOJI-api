/**
 * 栄養情報計算ロジック
 * 日本食品標準成分表ベースのデータを使用して一貫した計算を行う
 */

import {
  NUTRITION_DATABASE,
  STANDARD_PORTIONS,
  COOKING_TIME_BY_METHOD,
  OIL_CALORIES_BY_METHOD,
  type NutritionData,
} from './database';

export interface NutritionInfo {
  caloriesKcal: number;  // 1人前カロリー
  saltG: number;         // 1人前塩分
  timeMinutes: number;   // 調理時間
  isEstimate: boolean;   // 目安かどうか
  confidence: 'high' | 'medium' | 'low'; // 信頼度
}

export interface CalculationInput {
  ingredients: string[];           // 材料リスト
  kojiType?: string;               // 麹タイプ
  cookingMethod?: string;          // 調理法
  servings?: number;               // 人数（デフォルト2）
}

/**
 * 材料名から栄養データを検索（部分一致対応）
 */
function findNutritionData(ingredient: string): { data: NutritionData; portion: number } | null {
  const cleanedIng = ingredient.trim().replace(/[（）()]/g, '');
  
  // 完全一致を優先
  if (NUTRITION_DATABASE[cleanedIng]) {
    return {
      data: NUTRITION_DATABASE[cleanedIng],
      portion: STANDARD_PORTIONS[cleanedIng] || 50,
    };
  }
  
  // 部分一致検索
  for (const key of Object.keys(NUTRITION_DATABASE)) {
    if (cleanedIng.includes(key) || key.includes(cleanedIng)) {
      return {
        data: NUTRITION_DATABASE[key],
        portion: STANDARD_PORTIONS[key] || 50,
      };
    }
  }
  
  return null;
}

/**
 * 調理法を推定
 */
function detectCookingMethod(ingredients: string[], kojiType?: string): string {
  const ingredientStr = ingredients.join(' ').toLowerCase();
  
  // 特定のキーワードから調理法を推定
  if (ingredientStr.includes('スープ') || ingredientStr.includes('汁')) return 'スープ';
  if (ingredientStr.includes('味噌') || ingredientStr.includes('みそ')) return 'みそ汁';
  if (ingredientStr.includes('和え')) return '和え';
  if (ingredientStr.includes('炒め')) return '炒め';
  if (ingredientStr.includes('サラダ')) return 'サラダ';
  if (ingredientStr.includes('ナムル')) return 'ナムル';
  if (ingredientStr.includes('マリネ')) return 'マリネ';
  if (ingredientStr.includes('鍋')) return '鍋';
  if (ingredientStr.includes('煮')) return '煮';
  
  // 麹タイプから推定
  if (kojiType) {
    if (kojiType.includes('旨塩') || kojiType.includes('たまねぎ')) return '和え';
    if (kojiType.includes('中華')) return '炒め';
    if (kojiType.includes('コンソメ')) return 'スープ';
  }
  
  // デフォルト
  return '炒め';
}

/**
 * 栄養情報を計算
 */
export function calculateNutrition(input: CalculationInput): NutritionInfo {
  const { ingredients, kojiType, cookingMethod, servings = 2 } = input;
  
  let totalCalories = 0;
  let totalSalt = 0;
  let matchedCount = 0;
  let hasProtein = false;
  let hasVegetable = false;
  
  // 各材料の栄養を計算
  for (const ingredient of ingredients) {
    const result = findNutritionData(ingredient);
    if (result) {
      const { data, portion } = result;
      totalCalories += (data.calories * portion) / 100;
      totalSalt += (data.salt * portion) / 100;
      matchedCount++;
      
      if (data.category === 'protein') hasProtein = true;
      if (data.category === 'vegetable') hasVegetable = true;
    }
  }
  
  // 麹調味料の栄養を追加（未カウントの場合）
  if (kojiType) {
    const kojiResult = findNutritionData(kojiType);
    if (kojiResult) {
      totalCalories += (kojiResult.data.calories * kojiResult.portion) / 100;
      totalSalt += (kojiResult.data.salt * kojiResult.portion) / 100;
    } else {
      // デフォルトの麹調味料（大さじ1.5 = 22g）
      totalCalories += 18; // 約80kcal/100g × 22g
      totalSalt += 1.1;    // 約5g/100g × 22g
    }
  }
  
  // 調理法を決定
  const method = cookingMethod || detectCookingMethod(ingredients, kojiType);
  
  // 調理法による追加カロリー（油など）
  const oilCalories = OIL_CALORIES_BY_METHOD[method] || 30;
  totalCalories += oilCalories;
  
  // 調理時間を決定
  const baseTime = COOKING_TIME_BY_METHOD[method] || 10;
  // 材料が多い場合は下処理時間を追加
  const prepTime = Math.min(ingredients.length * 2, 10);
  const timeMinutes = baseTime + prepTime;
  
  // 1人前に換算
  const caloriesPerServing = totalCalories / servings;
  const saltPerServing = totalSalt / servings;
  
  // 信頼度を判定
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (matchedCount >= 3) {
    confidence = 'high';
  } else if (matchedCount >= 2) {
    confidence = 'medium';
  }
  
  // 妥当性チェック（異常値を補正）
  let finalCalories = Math.round(caloriesPerServing);
  let finalSalt = Math.round(saltPerServing * 10) / 10;
  
  // カロリーの妥当性チェック
  if (finalCalories < 50) {
    finalCalories = hasProtein ? 150 : 80;
    confidence = 'low';
  } else if (finalCalories > 800) {
    finalCalories = 500;
    confidence = 'medium';
  }
  
  // 塩分の妥当性チェック
  if (finalSalt < 0.3) {
    finalSalt = 1.0;
  } else if (finalSalt > 4.0) {
    finalSalt = 2.5;
  }
  
  return {
    caloriesKcal: finalCalories,
    saltG: finalSalt,
    timeMinutes: Math.round(timeMinutes),
    isEstimate: true, // 常に目安
    confidence,
  };
}

/**
 * クイックメニュー案用の簡易計算
 * 材料とカテゴリから概算
 */
export function calculateQuickNutrition(
  protein: string,
  veggie: string,
  kojiType: string,
  category: string
): NutritionInfo {
  const ingredients = [protein, veggie].filter(Boolean);
  
  // カテゴリから調理法を推定
  let cookingMethod = '炒め';
  if (category === '汁物') {
    if (kojiType.includes('コンソメ')) cookingMethod = 'スープ';
    else if (kojiType.includes('旨塩') || kojiType.includes('たまねぎ')) cookingMethod = 'みそ汁';
    else cookingMethod = '鍋';
  } else if (category === '副菜（サブ）') {
    if (kojiType.includes('旨塩') || kojiType.includes('たまねぎ')) cookingMethod = '和え';
    else if (kojiType.includes('中華')) cookingMethod = 'ナムル';
    else cookingMethod = 'サラダ';
  } else if (category === '5分で簡単レシピ') {
    cookingMethod = '和え';
  } else if (category === '材料1つでできる') {
    if (kojiType.includes('旨塩') || kojiType.includes('たまねぎ')) cookingMethod = '和え';
    else if (kojiType.includes('中華')) cookingMethod = 'ナムル';
    else cookingMethod = 'マリネ';
  }
  
  return calculateNutrition({
    ingredients,
    kojiType,
    cookingMethod,
    servings: 2,
  });
}

/**
 * レシピ詳細用の詳細計算
 * 材料リストと分量から計算
 */
export function calculateDetailedNutrition(
  ingredientList: Array<{ name: string; amount?: string }>,
  kojiType?: string,
  steps?: string[]
): NutritionInfo {
  const ingredients = ingredientList.map(i => i.name);
  
  // 手順から調理法を推定
  let cookingMethod: string | undefined;
  if (steps && steps.length > 0) {
    const stepsText = steps.join(' ');
    if (stepsText.includes('炒め') || stepsText.includes('フライパン')) cookingMethod = '炒め';
    else if (stepsText.includes('煮') || stepsText.includes('鍋で')) cookingMethod = '煮';
    else if (stepsText.includes('和え') || stepsText.includes('混ぜ')) cookingMethod = '和え';
    else if (stepsText.includes('スープ') || stepsText.includes('汁')) cookingMethod = 'スープ';
  }
  
  return calculateNutrition({
    ingredients,
    kojiType,
    cookingMethod,
    servings: 2,
  });
}
