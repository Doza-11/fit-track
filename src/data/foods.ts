/**
 * Seed food database — nutrition is per 100 g so every portion scales from a
 * single source of truth.
 *
 * Values are rounded reference figures for common preparations and will differ
 * from any specific recipe or brand. The shape mirrors what a food API would
 * return, so `services/foodRepository` can swap in a remote source later
 * without touching callers.
 */
import type { Food, FoodCategory, MealType, Nutrients, ServingSize } from '@/types'

type Macro = [cal: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number]
type ServingSpec = [label: string, grams: number]

function f(
  id: string,
  name: string,
  category: FoodCategory,
  [calories, protein, carbs, fat, fiber, sugar]: Macro,
  servings: ServingSpec[],
  commonMeals?: MealType[],
  brand?: string,
): Food {
  const per100g: Nutrients = { calories, protein, carbs, fat, fiber, sugar }
  const list: ServingSize[] = servings.map(([label, grams]) => ({ label, grams }))
  // Every food also offers a raw 100 g portion as a fallback unit.
  if (!list.some((s) => s.grams === 100)) list.push({ label: '100 g', grams: 100 })
  return { id, name, brand, category, per100g, servings: list, commonMeals }
}

export const SEED_FOODS: Food[] = [
  // ── Indian mains & breads ────────────────────────────────────────────────
  f('roti', 'Roti / Chapati', 'indian', [297, 11, 51, 7.5, 8, 1.6], [['1 roti', 40], ['2 rotis', 80]], ['lunch', 'dinner']),
  f('naan', 'Naan', 'indian', [310, 9, 52, 7, 2.5, 3.5], [['1 naan', 90]], ['lunch', 'dinner']),
  f('paratha-plain', 'Plain Paratha', 'indian', [330, 7.5, 44, 14, 4.5, 1.2], [['1 paratha', 60]], ['breakfast']),
  f('aloo-paratha', 'Aloo Paratha', 'indian', [280, 6, 39, 11, 3.5, 1.8], [['1 paratha', 110]], ['breakfast']),
  f('rice-white', 'White Rice (cooked)', 'grains', [130, 2.7, 28, 0.3, 0.4, 0.1], [['1 cup', 158], ['1 bowl', 200]], ['lunch', 'dinner']),
  f('rice-brown', 'Brown Rice (cooked)', 'grains', [123, 2.7, 26, 1, 1.8, 0.4], [['1 cup', 158]], ['lunch', 'dinner']),
  f('jeera-rice', 'Jeera Rice', 'indian', [165, 3, 30, 3.8, 0.9, 0.3], [['1 cup', 158]], ['lunch', 'dinner']),
  f('biryani-chicken', 'Chicken Biryani', 'indian', [180, 9, 22, 6.5, 1.2, 1.5], [['1 plate', 300], ['1 cup', 180]], ['lunch', 'dinner']),
  f('biryani-veg', 'Veg Biryani', 'indian', [155, 4, 25, 4.5, 1.8, 1.8], [['1 plate', 300]], ['lunch', 'dinner']),
  f('dal-tadka', 'Dal Tadka', 'indian', [120, 6, 15, 4, 4.5, 1.2], [['1 bowl', 150], ['1 cup', 200]], ['lunch', 'dinner']),
  f('dal-makhani', 'Dal Makhani', 'indian', [165, 6.5, 15, 9, 5, 1.8], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('rajma', 'Rajma (curry)', 'indian', [125, 6, 18, 3.2, 6, 2], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('chole', 'Chole / Chana Masala', 'indian', [145, 6.5, 20, 4.8, 6.5, 3], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('sambar', 'Sambar', 'indian', [85, 4, 11, 2.8, 3.2, 2], [['1 bowl', 150]], ['breakfast', 'lunch']),
  f('paneer-butter-masala', 'Paneer Butter Masala', 'indian', [230, 8.5, 9, 18, 1.5, 4.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('palak-paneer', 'Palak Paneer', 'indian', [180, 9, 7, 13, 2.5, 2.2], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('paneer-raw', 'Paneer', 'dairy', [296, 18, 3.5, 23, 0, 2.6], [['50 g', 50], ['100 g', 100]], ['lunch', 'dinner', 'snack']),
  f('butter-chicken', 'Butter Chicken', 'indian', [215, 14, 6, 15, 0.8, 3.5], [['1 bowl', 180]], ['lunch', 'dinner']),
  f('chicken-curry', 'Chicken Curry', 'indian', [160, 15, 5, 9, 1, 2], [['1 bowl', 180]], ['lunch', 'dinner']),
  f('idli', 'Idli', 'indian', [140, 4.5, 28, 0.9, 1.2, 0.4], [['1 idli', 40], ['2 idlis', 80]], ['breakfast']),
  f('dosa-plain', 'Plain Dosa', 'indian', [190, 4.5, 30, 6, 1.5, 0.6], [['1 dosa', 90]], ['breakfast', 'dinner']),
  f('masala-dosa', 'Masala Dosa', 'indian', [185, 4.2, 28, 6.5, 2.2, 1.2], [['1 dosa', 150]], ['breakfast', 'dinner']),
  f('upma', 'Upma', 'indian', [155, 3.8, 23, 5.5, 1.8, 1], [['1 bowl', 150]], ['breakfast']),
  f('poha', 'Poha', 'indian', [130, 2.6, 23, 3.2, 1.2, 1.5], [['1 bowl', 150]], ['breakfast']),
  f('khichdi', 'Khichdi', 'indian', [120, 4.5, 19, 2.8, 2, 0.6], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('pav-bhaji', 'Pav Bhaji', 'indian', [190, 4.5, 24, 8.5, 3.2, 3.5], [['1 plate', 250]], ['snack', 'dinner']),
  f('samosa', 'Samosa', 'indian', [308, 5, 32, 18, 2.8, 1.5], [['1 samosa', 60]], ['snack']),
  f('pakora', 'Pakora / Bhaji', 'indian', [315, 7, 28, 19, 3.5, 1.8], [['1 plate', 80]], ['snack']),
  f('dhokla', 'Dhokla', 'indian', [160, 6, 22, 5, 2.2, 3], [['2 pieces', 80]], ['snack', 'breakfast']),
  f('vada-pav', 'Vada Pav', 'indian', [280, 6.5, 38, 11, 2.5, 3], [['1 piece', 120]], ['snack']),
  f('curd-rice', 'Curd Rice', 'indian', [110, 3.5, 17, 3, 0.5, 1.8], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('raita', 'Raita', 'indian', [60, 3, 5, 3, 0.5, 4], [['1 bowl', 100]], ['lunch', 'dinner']),

  // ── Protein ──────────────────────────────────────────────────────────────
  f('chicken-breast', 'Chicken Breast (cooked)', 'protein', [165, 31, 0, 3.6, 0, 0], [['100 g', 100], ['1 breast', 174]], ['lunch', 'dinner']),
  f('chicken-thigh', 'Chicken Thigh (cooked)', 'protein', [209, 26, 0, 11, 0, 0], [['1 thigh', 110]], ['lunch', 'dinner']),
  f('tandoori-chicken', 'Tandoori Chicken', 'indian', [185, 25, 3, 8, 0.4, 1.5], [['2 pieces', 150]], ['dinner']),
  f('egg-whole', 'Egg (whole, boiled)', 'protein', [155, 13, 1.1, 11, 0, 1.1], [['1 egg', 50], ['2 eggs', 100]], ['breakfast']),
  f('egg-white', 'Egg White', 'protein', [52, 11, 0.7, 0.2, 0, 0.7], [['1 white', 33]], ['breakfast']),
  f('omelette', 'Omelette (2 eggs)', 'protein', [175, 12, 1.5, 13.5, 0.2, 1], [['1 omelette', 120]], ['breakfast']),
  f('fish-salmon', 'Salmon (cooked)', 'protein', [208, 20, 0, 13, 0, 0], [['1 fillet', 150]], ['lunch', 'dinner']),
  f('fish-rohu', 'Fish Curry', 'indian', [140, 16, 4, 6.5, 0.6, 1.2], [['1 bowl', 180]], ['lunch', 'dinner']),
  f('prawns', 'Prawns (cooked)', 'protein', [99, 24, 0.2, 0.3, 0, 0], [['100 g', 100]], ['lunch', 'dinner']),
  f('mutton-curry', 'Mutton Curry', 'indian', [230, 18, 4, 16, 0.8, 1.5], [['1 bowl', 180]], ['lunch', 'dinner']),
  f('tofu', 'Tofu', 'protein', [76, 8, 1.9, 4.8, 0.3, 0.6], [['100 g', 100]], ['lunch', 'dinner']),
  f('soya-chunks', 'Soya Chunks (cooked)', 'protein', [102, 14, 7, 0.5, 3.5, 1.5], [['1 bowl', 100]], ['lunch', 'dinner']),
  f('whey-protein', 'Whey Protein Powder', 'protein', [380, 78, 8, 4, 1, 4], [['1 scoop', 30]], ['snack', 'drink']),
  f('sprouts', 'Moong Sprouts', 'vegetable', [98, 8, 13, 0.6, 4.5, 2], [['1 bowl', 100]], ['breakfast', 'snack']),

  // ── Dairy ────────────────────────────────────────────────────────────────
  f('milk-full', 'Milk (full fat)', 'dairy', [61, 3.2, 4.8, 3.3, 0, 4.8], [['1 glass', 240], ['1 cup', 200]], ['breakfast', 'drink']),
  f('milk-toned', 'Milk (toned)', 'dairy', [47, 3.1, 4.9, 1.7, 0, 4.9], [['1 glass', 240]], ['breakfast', 'drink']),
  f('curd', 'Curd / Dahi', 'dairy', [61, 3.5, 4.7, 3.3, 0, 4.7], [['1 bowl', 150], ['1 cup', 200]], ['lunch', 'snack']),
  f('greek-yogurt', 'Greek Yogurt (plain)', 'dairy', [59, 10, 3.6, 0.4, 0, 3.2], [['1 cup', 170]], ['breakfast', 'snack']),
  f('lassi-sweet', 'Sweet Lassi', 'beverage', [90, 2.6, 14, 2.5, 0, 13], [['1 glass', 250]], ['drink']),
  f('buttermilk', 'Buttermilk / Chaas', 'beverage', [30, 1.6, 3, 1.2, 0, 3], [['1 glass', 250]], ['drink']),
  f('cheese-slice', 'Cheese (processed)', 'dairy', [350, 20, 2.5, 29, 0, 1.5], [['1 slice', 20]], ['breakfast', 'snack']),
  f('butter', 'Butter', 'dairy', [717, 0.9, 0.1, 81, 0, 0.1], [['1 tsp', 5], ['1 tbsp', 14]], ['breakfast']),
  f('ghee', 'Ghee', 'dairy', [900, 0, 0, 100, 0, 0], [['1 tsp', 5], ['1 tbsp', 14]]),

  // ── Grains, breakfast & legumes ──────────────────────────────────────────
  f('oats', 'Oats (dry)', 'grains', [389, 17, 66, 7, 11, 1], [['1/2 cup', 40], ['1 cup', 80]], ['breakfast']),
  f('oats-cooked', 'Oatmeal (cooked in water)', 'grains', [71, 2.5, 12, 1.5, 1.7, 0.3], [['1 bowl', 240]], ['breakfast']),
  f('bread-white', 'White Bread', 'grains', [265, 9, 49, 3.2, 2.7, 5], [['1 slice', 28], ['2 slices', 56]], ['breakfast']),
  f('bread-brown', 'Brown / Whole Wheat Bread', 'grains', [247, 13, 41, 3.4, 7, 4.3], [['1 slice', 30], ['2 slices', 60]], ['breakfast']),
  f('poha-raw', 'Poha (raw flattened rice)', 'grains', [346, 6.6, 77, 1.2, 2.5, 0.5], [['1 cup', 60]]),
  f('quinoa', 'Quinoa (cooked)', 'grains', [120, 4.4, 21, 1.9, 2.8, 0.9], [['1 cup', 185]], ['lunch']),
  f('pasta', 'Pasta (cooked)', 'grains', [131, 5, 25, 1.1, 1.8, 0.6], [['1 cup', 140]], ['lunch', 'dinner']),
  f('poori', 'Poori', 'indian', [385, 7, 45, 20, 3, 1], [['1 poori', 35]], ['breakfast']),
  f('cornflakes', 'Cornflakes', 'grains', [357, 7.5, 84, 0.4, 3, 8], [['1 bowl', 30]], ['breakfast']),
  f('muesli', 'Muesli', 'grains', [375, 10, 66, 6.5, 8, 16], [['1 bowl', 50]], ['breakfast']),
  f('peanut-butter', 'Peanut Butter', 'snack', [588, 25, 20, 50, 6, 9], [['1 tbsp', 16], ['2 tbsp', 32]], ['breakfast', 'snack']),

  // ── Fruit ────────────────────────────────────────────────────────────────
  f('banana', 'Banana', 'fruit', [89, 1.1, 23, 0.3, 2.6, 12], [['1 medium', 118], ['1 small', 90]], ['breakfast', 'snack']),
  f('apple', 'Apple', 'fruit', [52, 0.3, 14, 0.2, 2.4, 10], [['1 medium', 182]], ['snack']),
  f('orange', 'Orange', 'fruit', [47, 0.9, 12, 0.1, 2.4, 9], [['1 medium', 130]], ['snack']),
  f('mango', 'Mango', 'fruit', [60, 0.8, 15, 0.4, 1.6, 14], [['1 cup', 165], ['1 medium', 200]], ['snack']),
  f('grapes', 'Grapes', 'fruit', [69, 0.7, 18, 0.2, 0.9, 16], [['1 cup', 150]], ['snack']),
  f('papaya', 'Papaya', 'fruit', [43, 0.5, 11, 0.3, 1.7, 7.8], [['1 cup', 145]], ['breakfast', 'snack']),
  f('watermelon', 'Watermelon', 'fruit', [30, 0.6, 8, 0.2, 0.4, 6], [['1 cup', 152]], ['snack']),
  f('pomegranate', 'Pomegranate', 'fruit', [83, 1.7, 19, 1.2, 4, 14], [['1 cup', 174]], ['snack']),
  f('guava', 'Guava', 'fruit', [68, 2.6, 14, 1, 5.4, 9], [['1 medium', 55]], ['snack']),
  f('strawberries', 'Strawberries', 'fruit', [32, 0.7, 7.7, 0.3, 2, 4.9], [['1 cup', 150]], ['snack']),
  f('dates', 'Dates', 'fruit', [277, 1.8, 75, 0.2, 6.7, 66], [['2 dates', 16]], ['snack']),
  f('almonds', 'Almonds', 'snack', [579, 21, 22, 50, 12.5, 4.4], [['10 almonds', 12], ['1 handful', 28]], ['snack']),
  f('walnuts', 'Walnuts', 'snack', [654, 15, 14, 65, 6.7, 2.6], [['1 handful', 28]], ['snack']),
  f('cashews', 'Cashews', 'snack', [553, 18, 30, 44, 3.3, 6], [['1 handful', 28]], ['snack']),
  f('peanuts', 'Peanuts (roasted)', 'snack', [567, 26, 16, 49, 8.5, 4], [['1 handful', 28]], ['snack']),

  // ── Vegetables ───────────────────────────────────────────────────────────
  f('mixed-veg-sabzi', 'Mixed Veg Sabzi', 'indian', [105, 3, 12, 5.5, 3.8, 4], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('aloo-sabzi', 'Aloo Sabzi', 'indian', [130, 2.5, 18, 5.5, 2.5, 1.8], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('bhindi-fry', 'Bhindi Fry', 'indian', [125, 2.2, 9, 9, 3.5, 2], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('potato-boiled', 'Potato (boiled)', 'vegetable', [87, 1.9, 20, 0.1, 1.8, 0.9], [['1 medium', 150]]),
  f('broccoli', 'Broccoli (cooked)', 'vegetable', [35, 2.4, 7, 0.4, 3.3, 1.4], [['1 cup', 156]], ['lunch', 'dinner']),
  f('spinach', 'Spinach (cooked)', 'vegetable', [23, 2.9, 3.6, 0.4, 2.2, 0.4], [['1 cup', 180]], ['lunch', 'dinner']),
  f('salad-green', 'Green Salad', 'vegetable', [25, 1.2, 5, 0.2, 1.8, 2.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('cucumber', 'Cucumber', 'vegetable', [15, 0.7, 3.6, 0.1, 0.5, 1.7], [['1 medium', 200]], ['snack']),
  f('carrot', 'Carrot', 'vegetable', [41, 0.9, 10, 0.2, 2.8, 4.7], [['1 medium', 61]], ['snack']),
  f('tomato', 'Tomato', 'vegetable', [18, 0.9, 3.9, 0.2, 1.2, 2.6], [['1 medium', 123]]),
  f('corn', 'Sweet Corn', 'vegetable', [96, 3.4, 21, 1.5, 2.4, 4.5], [['1 cup', 154]], ['snack']),

  // ── Fast food & snacks ───────────────────────────────────────────────────
  f('pizza', 'Pizza (cheese)', 'fastfood', [266, 11, 33, 10, 2.3, 3.6], [['1 slice', 107], ['2 slices', 214]], ['dinner']),
  f('burger', 'Veg Burger', 'fastfood', [250, 8, 33, 9.5, 2.5, 5], [['1 burger', 150]], ['lunch', 'dinner']),
  f('chicken-burger', 'Chicken Burger', 'fastfood', [270, 14, 28, 11, 1.8, 5], [['1 burger', 170]], ['lunch', 'dinner']),
  f('fries', 'French Fries', 'fastfood', [312, 3.4, 41, 15, 3.8, 0.3], [['1 medium', 117]], ['snack']),
  f('sandwich-veg', 'Veg Sandwich', 'fastfood', [220, 7, 30, 8, 2.8, 4], [['1 sandwich', 160]], ['breakfast', 'snack']),
  f('maggi', 'Instant Noodles', 'fastfood', [400, 9, 55, 16, 2.5, 3], [['1 pack', 70]], ['snack']),
  f('momos', 'Momos (veg)', 'fastfood', [190, 6, 28, 6, 1.8, 1.5], [['6 pieces', 180]], ['snack']),
  f('chips', 'Potato Chips', 'snack', [536, 7, 53, 34, 4.4, 0.3], [['1 small pack', 30]], ['snack']),
  f('biscuits', 'Biscuits (marie)', 'snack', [440, 7, 75, 12, 2, 22], [['3 biscuits', 20]], ['snack']),
  f('popcorn', 'Popcorn (plain)', 'snack', [387, 13, 78, 4.5, 15, 0.9], [['1 bowl', 25]], ['snack']),
  f('bhel-puri', 'Bhel Puri', 'indian', [245, 6, 38, 8, 4, 5], [['1 plate', 100]], ['snack']),
  f('poha-chivda', 'Chivda / Namkeen', 'snack', [480, 10, 52, 26, 5, 4], [['1 small bowl', 30]], ['snack']),

  // ── Desserts ─────────────────────────────────────────────────────────────
  f('gulab-jamun', 'Gulab Jamun', 'dessert', [330, 4, 48, 13, 0.5, 40], [['1 piece', 45], ['2 pieces', 90]], ['dessert']),
  f('rasgulla', 'Rasgulla', 'dessert', [186, 4, 38, 2, 0, 35], [['1 piece', 50]], ['dessert']),
  f('kheer', 'Kheer', 'dessert', [145, 3.8, 22, 4.8, 0.4, 18], [['1 bowl', 150]], ['dessert']),
  f('halwa', 'Gajar Halwa', 'dessert', [280, 4, 34, 14, 2, 28], [['1 bowl', 100]], ['dessert']),
  f('ice-cream', 'Ice Cream (vanilla)', 'dessert', [207, 3.5, 24, 11, 0.7, 21], [['1 scoop', 65]], ['dessert']),
  f('chocolate-milk', 'Milk Chocolate', 'dessert', [535, 7.6, 59, 30, 3.4, 52], [['1 small bar', 40]], ['dessert']),
  f('jalebi', 'Jalebi', 'dessert', [365, 3, 60, 13, 0.5, 45], [['2 pieces', 50]], ['dessert']),
  f('brownie', 'Chocolate Brownie', 'dessert', [466, 6, 50, 28, 2.5, 35], [['1 piece', 60]], ['dessert']),
  f('laddu', 'Besan Laddu', 'dessert', [430, 8, 48, 23, 3, 32], [['1 laddu', 40]], ['dessert']),

  // ── Beverages ────────────────────────────────────────────────────────────
  f('tea-milk', 'Chai (with milk & sugar)', 'beverage', [50, 1.3, 7.5, 1.6, 0, 7], [['1 cup', 150]], ['drink']),
  f('coffee-milk', 'Coffee (with milk & sugar)', 'beverage', [56, 1.6, 8, 1.8, 0, 7.5], [['1 cup', 150]], ['drink']),
  f('black-coffee', 'Black Coffee (no sugar)', 'beverage', [1, 0.1, 0, 0, 0, 0], [['1 cup', 150]], ['drink']),
  f('green-tea', 'Green Tea', 'beverage', [1, 0, 0.2, 0, 0, 0], [['1 cup', 150]], ['drink']),
  f('orange-juice', 'Orange Juice', 'beverage', [45, 0.7, 10, 0.2, 0.2, 8.4], [['1 glass', 250]], ['drink']),
  f('cola', 'Cola / Soft Drink', 'beverage', [42, 0, 10.6, 0, 0, 10.6], [['1 can', 330], ['1 glass', 250]], ['drink']),
  f('beer', 'Beer', 'beverage', [43, 0.5, 3.6, 0, 0, 0], [['1 bottle', 330]], ['drink']),
  f('coconut-water', 'Coconut Water', 'beverage', [19, 0.7, 3.7, 0.2, 1.1, 2.6], [['1 glass', 250]], ['drink']),
  f('protein-shake', 'Protein Shake (with milk)', 'beverage', [95, 11, 6, 3, 0.4, 5], [['1 glass', 300]], ['drink', 'snack']),
  f('nimbu-pani', 'Nimbu Pani (sweetened)', 'beverage', [38, 0.1, 9.8, 0, 0.1, 9.5], [['1 glass', 250]], ['drink']),

  // ── Condiments & fats ────────────────────────────────────────────────────
  f('oil', 'Cooking Oil', 'condiment', [884, 0, 0, 100, 0, 0], [['1 tsp', 5], ['1 tbsp', 14]]),
  f('sugar', 'Sugar', 'condiment', [387, 0, 100, 0, 0, 100], [['1 tsp', 4]]),
  f('honey', 'Honey', 'condiment', [304, 0.3, 82, 0, 0.2, 82], [['1 tsp', 7], ['1 tbsp', 21]]),
  f('ketchup', 'Tomato Ketchup', 'condiment', [101, 1.2, 25, 0.1, 0.3, 22], [['1 tbsp', 17]]),
  f('mayonnaise', 'Mayonnaise', 'condiment', [680, 1, 0.6, 75, 0, 0.6], [['1 tbsp', 14]]),
  f('chutney-coconut', 'Coconut Chutney', 'indian', [190, 3, 7, 17, 4, 2.5], [['2 tbsp', 40]]),
  f('pickle', 'Pickle / Achar', 'indian', [180, 1, 8, 16, 2, 3], [['1 tbsp', 15]]),

  // ── Regional dishes, sweets and packaged snacks ──────────────────────────
  // Supplied as per-serving figures and converted here to per-100g using the
  // serving weights below, so any portion still scales from one source of
  // truth. Fiber and sugar were not in the source data and are estimates by
  // food type; calories and macros are as given.
  f('thepla', 'Thepla', 'indian', [300.0, 7.5, 42.5, 12.5, 5.0, 1.5], [['1 thepla', 40]], ['breakfast', 'snack']),
  f('methi-thepla', 'Methi Thepla', 'indian', [312.5, 7.5, 45.0, 12.5, 6.0, 1.5], [['1 thepla', 40]], ['breakfast', 'snack']),
  f('bajra-rotla', 'Bajra Rotla', 'indian', [300.0, 8.3, 56.7, 5.0, 7.0, 1.0], [['1 rotla', 60]], ['lunch', 'dinner']),
  f('jowar-bhakri', 'Jowar Bhakri', 'indian', [272.7, 7.3, 56.4, 3.6, 6.5, 1.0], [['1 bhakri', 55]], ['lunch', 'dinner']),
  f('makai-roti', 'Makai Roti', 'indian', [272.7, 7.3, 54.5, 3.6, 5.5, 1.2], [['1 roti', 55]], ['lunch', 'dinner']),
  f('missi-roti', 'Missi Roti', 'indian', [280.0, 10.0, 44.0, 8.0, 5.5, 1.2], [['1 roti', 50]], ['lunch', 'dinner']),
  f('laccha-paratha', 'Laccha Paratha', 'indian', [293.3, 6.7, 40.0, 12.0, 3.5, 1.2], [['1 paratha', 75]], ['lunch', 'dinner']),
  f('gobi-paratha', 'Gobi Paratha', 'indian', [200.0, 5.3, 29.5, 7.4, 3.8, 1.8], [['1 paratha', 95]], ['breakfast', 'lunch']),
  f('methi-paratha', 'Methi Paratha', 'indian', [225.0, 6.2, 33.8, 7.5, 4.5, 1.5], [['1 paratha', 80]], ['breakfast', 'lunch']),
  f('misal-pav', 'Misal Pav', 'indian', [116.7, 4.7, 15.0, 4.3, 5.0, 2.0], [['1 plate', 300]], ['breakfast', 'lunch']),
  f('misal-without-pav', 'Misal (without pav)', 'indian', [120.0, 6.0, 15.0, 4.5, 6.0, 2.0], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('kachori', 'Kachori', 'indian', [360.0, 8.0, 40.0, 18.0, 2.5, 1.0], [['1 piece', 50]], ['snack']),
  f('aloo-tikki', 'Aloo Tikki', 'indian', [180.0, 4.0, 28.0, 6.0, 3.0, 1.5], [['2 pieces', 100]], ['snack']),
  f('onion-bhaji', 'Onion Bhaji', 'indian', [316.7, 6.7, 36.7, 16.7, 3.2, 2.5], [['4 pieces', 60]], ['snack']),
  f('medu-vada', 'Medu Vada', 'indian', [311.1, 8.9, 33.3, 15.6, 4.0, 1.0], [['2 pieces', 90]], ['breakfast', 'snack']),
  f('uttapam', 'Uttapam', 'indian', [163.6, 4.5, 26.4, 4.5, 2.5, 1.5], [['1 uttapam', 110]], ['breakfast', 'dinner']),
  f('rava-dosa', 'Rava Dosa', 'indian', [222.2, 4.4, 31.1, 8.9, 1.8, 1.0], [['1 dosa', 90]], ['breakfast', 'dinner']),
  f('set-dosa', 'Set Dosa', 'indian', [183.3, 4.2, 31.7, 4.2, 2.0, 1.0], [['2 pieces', 120]], ['breakfast']),
  f('appam', 'Appam', 'indian', [172.7, 3.6, 33.6, 2.7, 1.8, 3.0], [['2 pieces', 110]], ['breakfast']),
  f('pongal', 'Pongal', 'indian', [125.0, 3.5, 17.5, 4.5, 3.0, 0.8], [['1 bowl', 200]], ['breakfast']),
  f('lemon-rice', 'Lemon Rice', 'indian', [125.0, 2.5, 21.0, 3.5, 1.5, 0.8], [['1 bowl', 200]], ['lunch']),
  f('tamarind-rice', 'Tamarind Rice', 'indian', [140.0, 3.0, 21.5, 4.5, 1.8, 3.0], [['1 bowl', 200]], ['lunch']),
  f('vegetable-pulao', 'Vegetable Pulao', 'indian', [120.0, 3.0, 19.5, 3.5, 2.5, 2.0], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('masala-chaas', 'Masala Chaas', 'beverage', [20.0, 0.8, 2.0, 0.8, 0.2, 3.5], [['1 glass', 250]], ['drink']),
  f('sprouts-chaat', 'Sprouts Chaat', 'indian', [106.7, 6.0, 16.7, 2.0, 5.5, 3.0], [['1 bowl', 150]], ['breakfast', 'snack']),
  f('sev-puri', 'Sev Puri', 'indian', [250.0, 5.0, 33.3, 10.8, 3.5, 4.0], [['6 pieces', 120]], ['snack']),
  f('dahi-puri', 'Dahi Puri', 'indian', [228.6, 5.7, 30.0, 9.3, 3.2, 5.0], [['6 pieces', 140]], ['snack']),
  f('ragda-pattice', 'Ragda Pattice', 'indian', [140.0, 3.6, 22.0, 4.4, 5.5, 3.0], [['1 plate', 250]], ['snack', 'dinner']),
  f('khandvi', 'Khandvi', 'indian', [188.9, 7.8, 22.2, 7.8, 2.0, 2.5], [['6 pieces', 90]], ['snack']),
  f('fafda', 'Fafda', 'indian', [540.0, 12.0, 56.0, 30.0, 3.0, 1.0], [['50 g', 50]], ['snack']),
  f('jalebi-fafda', 'Jalebi Fafda', 'indian', [330.8, 5.4, 50.0, 12.3, 2.5, 30.0], [['1 serving', 130]], ['breakfast', 'snack']),
  f('handvo', 'Handvo', 'indian', [220.0, 7.0, 30.0, 8.0, 4.0, 2.0], [['1 piece', 100]], ['snack', 'breakfast']),
  f('gujarati-kadhi', 'Gujarati Kadhi', 'indian', [75.0, 2.5, 8.5, 3.5, 1.0, 6.0], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('undhiyu', 'Undhiyu', 'indian', [146.7, 4.0, 16.0, 7.3, 5.5, 3.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('sev-tameta', 'Sev Tameta', 'indian', [160.0, 3.3, 16.0, 9.3, 3.0, 4.0], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('tuvar-dal', 'Tuvar Dal', 'indian', [85.0, 4.5, 12.5, 2.0, 5.0, 1.5], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('gujarati-dal', 'Gujarati Dal', 'indian', [80.0, 3.5, 12.5, 2.0, 4.5, 4.0], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('moong-dal', 'Moong Dal', 'indian', [75.0, 4.5, 11.5, 1.5, 5.0, 1.2], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('masoor-dal', 'Masoor Dal', 'indian', [85.0, 5.0, 12.5, 2.0, 5.5, 1.2], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('chana-salad', 'Chana Salad', 'indian', [140.0, 6.7, 21.3, 3.3, 7.0, 3.0], [['1 bowl', 150]], ['lunch', 'snack']),
  f('black-chana', 'Black Chana', 'indian', [146.7, 7.3, 23.3, 2.7, 8.0, 2.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('lobia-curry', 'Lobia Curry', 'indian', [140.0, 7.3, 19.3, 4.0, 7.0, 2.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('matar-paneer', 'Matar Paneer', 'indian', [193.3, 9.3, 10.7, 13.3, 3.0, 4.0], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('shahi-paneer', 'Shahi Paneer', 'indian', [220.0, 8.7, 10.0, 16.7, 1.8, 5.0], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('kadai-paneer', 'Kadai Paneer', 'indian', [200.0, 9.3, 9.3, 14.7, 2.2, 3.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('chana-dal', 'Chana Dal', 'indian', [95.0, 5.0, 14.5, 2.5, 5.5, 1.5], [['1 bowl', 200]], ['lunch', 'dinner']),
  f('baingan-bharta', 'Baingan Bharta', 'indian', [100.0, 2.0, 10.0, 6.0, 4.0, 4.0], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('lauki-sabzi', 'Lauki Sabzi', 'indian', [66.7, 1.3, 8.0, 3.3, 2.5, 3.0], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('cabbage-sabzi', 'Cabbage Sabzi', 'indian', [80.0, 2.0, 9.3, 4.0, 3.5, 3.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('palak-sabzi', 'Palak Sabzi', 'indian', [73.3, 2.7, 6.7, 4.0, 3.0, 1.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('tinda-sabzi', 'Tinda Sabzi', 'indian', [66.7, 1.3, 8.0, 3.3, 2.5, 3.0], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('methi-sabzi', 'Methi Sabzi', 'indian', [86.7, 2.7, 8.0, 4.7, 4.0, 1.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('corn-sabzi', 'Corn Sabzi', 'indian', [120.0, 3.3, 18.7, 4.0, 3.5, 5.0], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('aloo-gobi', 'Aloo Gobi', 'indian', [120.0, 2.7, 16.7, 4.7, 3.5, 2.5], [['1 bowl', 150]], ['lunch', 'dinner']),
  f('chole-chaat', 'Chole Chaat', 'indian', [153.3, 6.7, 23.3, 4.0, 7.5, 3.5], [['1 bowl', 150]], ['snack', 'lunch']),
  f('egg-curry', 'Egg Curry', 'indian', [144.4, 9.4, 5.6, 9.4, 1.5, 3.0], [['1 bowl', 180]], ['lunch', 'dinner']),
  f('egg-bhurji', 'Egg Bhurji', 'indian', [146.7, 9.3, 3.3, 10.7, 1.2, 2.5], [['1 bowl', 150]], ['breakfast', 'dinner']),
  f('chicken-tikka', 'Chicken Tikka', 'indian', [180.0, 27.0, 3.0, 7.0, 0.4, 1.5], [['100 g', 100]], ['dinner', 'snack']),
  f('chicken-kebab', 'Chicken Kebab', 'indian', [200.0, 25.0, 4.0, 9.0, 0.5, 1.5], [['100 g', 100]], ['dinner', 'snack']),
  f('chicken-65', 'Chicken 65', 'indian', [260.0, 20.0, 12.0, 16.0, 0.8, 1.5], [['100 g', 100]], ['dinner', 'snack']),
  f('fish-fry', 'Fish Fry', 'indian', [220.0, 22.0, 7.0, 12.0, 0.5, 0.8], [['100 g', 100]], ['lunch', 'dinner']),
  f('prawn-fry', 'Prawn Fry', 'indian', [190.0, 22.0, 5.0, 9.0, 0.4, 0.8], [['100 g', 100]], ['lunch', 'dinner']),
  f('mutton-biryani', 'Mutton Biryani', 'indian', [160.0, 7.1, 17.4, 6.6, 2.0, 2.0], [['1 plate', 350]], ['lunch', 'dinner']),
  f('egg-biryani', 'Egg Biryani', 'indian', [150.0, 5.7, 20.0, 5.0, 2.0, 2.0], [['1 plate', 300]], ['lunch', 'dinner']),
  f('rawa-shira-sooji-halwa', 'Rawa Shira / Sooji Halwa', 'dessert', [280.0, 5.0, 40.0, 11.0, 1.2, 25.0], [['1 small bowl', 100]], ['dessert']),
  f('rajgira-shira', 'Rajgira Shira', 'dessert', [290.0, 6.0, 38.0, 13.0, 2.5, 22.0], [['1 small bowl', 100]], ['dessert']),
  f('sukhdi-gol-papdi', 'Sukhdi / Gol Papdi', 'dessert', [485.7, 5.7, 60.0, 25.7, 1.5, 30.0], [['1 piece', 35]], ['dessert']),
  f('farsi-puri', 'Farsi Puri', 'snack', [500.0, 6.7, 56.7, 26.7, 2.0, 1.0], [['3 pieces', 30]], ['snack']),
  f('mohanthal', 'Mohanthal', 'dessert', [514.3, 11.4, 60.0, 25.7, 2.0, 32.0], [['1 piece', 35]], ['dessert']),
  f('basundi', 'Basundi', 'dessert', [208.3, 5.8, 23.3, 10.0, 0.3, 20.0], [['1 small bowl', 120]], ['dessert']),
  f('shrikhand', 'Shrikhand', 'dessert', [220.0, 7.0, 28.0, 9.0, 0.4, 25.0], [['1 small bowl', 100]], ['dessert']),
  f('modak', 'Modak', 'dessert', [340.0, 6.0, 56.0, 12.0, 1.8, 28.0], [['1 piece', 50]], ['dessert']),
  f('puran-poli', 'Puran Poli', 'dessert', [311.1, 7.8, 53.3, 8.9, 3.0, 25.0], [['1 piece', 90]], ['dessert']),
  f('chikki', 'Chikki', 'dessert', [500.0, 13.3, 56.7, 26.7, 2.5, 45.0], [['30 g', 30]], ['dessert', 'snack']),
  f('til-chikki', 'Til Chikki', 'dessert', [516.7, 10.0, 60.0, 26.7, 3.5, 45.0], [['30 g', 30]], ['dessert', 'snack']),
  f('coconut-ladoo', 'Coconut Ladoo', 'dessert', [466.7, 3.3, 63.3, 23.3, 3.5, 45.0], [['1 laddu', 30]], ['dessert']),
  f('motichoor-ladoo', 'Motichoor Ladoo', 'dessert', [450.0, 7.5, 62.5, 20.0, 1.0, 40.0], [['1 laddu', 40]], ['dessert']),
  f('milk-cake', 'Milk Cake', 'dessert', [400.0, 12.5, 50.0, 17.5, 0.2, 38.0], [['1 piece', 40]], ['dessert']),
  f('parle-g-biscuits', 'Parle-G Biscuits', 'snack', [480.0, 8.0, 80.0, 16.0, 1.5, 22.0], [['5 biscuits', 25]], ['snack'], 'Parle'),
  f('marie-gold-biscuits', 'Marie Gold Biscuits', 'snack', [450.0, 6.7, 73.3, 13.3, 1.8, 20.0], [['6 biscuits', 30]], ['snack'], 'Britannia'),
  f('hide-seek-biscuits', 'Hide & Seek Biscuits', 'snack', [483.3, 6.7, 66.7, 23.3, 1.5, 28.0], [['4 biscuits', 30]], ['snack'], 'Parle'),
  f('kurkure', 'Kurkure', 'snack', [509.1, 7.3, 56.4, 29.1, 2.0, 2.0], [['1 small pack', 55]], ['snack'], 'Kurkure'),
  f('lays-potato-chips', 'Lay\'s Potato Chips', 'snack', [540.0, 6.0, 56.0, 32.0, 3.0, 1.0], [['1 small pack', 50]], ['snack'], 'Lay\'s'),
  f('aloo-bhujia', 'Aloo Bhujia', 'snack', [550.0, 13.3, 40.0, 36.7, 3.0, 1.5], [['30 g', 30]], ['snack'], 'Haldiram\'s'),
  f('moong-dal-namkeen', 'Moong Dal Namkeen', 'snack', [516.7, 23.3, 43.3, 26.7, 4.5, 1.0], [['30 g', 30]], ['snack'], 'Haldiram\'s'),
  f('maggi-2-minute-noodles', 'Maggi 2-Minute Noodles', 'fastfood', [442.9, 10.0, 62.9, 17.1, 2.5, 3.0], [['1 pack', 70]], ['snack'], 'Maggi'),
  f('dark-chocolate', 'Dark Chocolate', 'dessert', [550.0, 10.0, 50.0, 35.0, 7.0, 35.0], [['20 g', 20]], ['dessert'], 'Amul'),
  f('amul-milk-chocolate', 'Amul Milk Chocolate', 'dessert', [550.0, 10.0, 60.0, 30.0, 2.0, 52.0], [['20 g', 20]], ['dessert'], 'Amul'),
]

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  indian: 'Indian',
  grains: 'Grains',
  protein: 'Protein',
  dairy: 'Dairy',
  fruit: 'Fruit',
  vegetable: 'Vegetables',
  snack: 'Snacks',
  fastfood: 'Fast food',
  dessert: 'Desserts',
  beverage: 'Beverages',
  condiment: 'Condiments',
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  drink: 'Drinks',
  dessert: 'Desserts',
}

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'drink', 'dessert']

export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🍳', lunch: '🍽️', dinner: '🌙', snack: '🥨', drink: '🥤', dessert: '🍰',
}
