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
): Food {
  const per100g: Nutrients = { calories, protein, carbs, fat, fiber, sugar }
  const list: ServingSize[] = servings.map(([label, grams]) => ({ label, grams }))
  // Every food also offers a raw 100 g portion as a fallback unit.
  if (!list.some((s) => s.grams === 100)) list.push({ label: '100 g', grams: 100 })
  return { id, name, category, per100g, servings: list, commonMeals }
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
