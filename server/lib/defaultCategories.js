export const defaultCategories = [
  ['Mobiles & Electronics', 'Smartphone'],
  ['Vehicles', 'CarFront'],
  ['Furniture', 'Armchair'],
  ['Books & Study', 'BookOpen'],
  ['Clothes & Fashion', 'Shirt'],
  ['Sports & Fitness', 'Dumbbell'],
  ['Home & Kitchen', 'CookingPot'],
  ['Jobs', 'BriefcaseBusiness'],
  ['Property & Rooms', 'House'],
  ['Local Services', 'Wrench'],
  ['Local Products', 'Package'],
  ['Buy / Sell / Exchange', 'Repeat2'],
  ['Other', 'ShoppingBag']
].map(([name, icon], order) => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  icon,
  order,
  active: true
}))
