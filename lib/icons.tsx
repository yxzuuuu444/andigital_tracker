import { CircleEllipsis, Fuel, Heart, Receipt, ShoppingBag, Utensils, Circle, type LucideIcon } from "lucide-react";

const map: Record<string, LucideIcon> = {
  utensils: Utensils,
  fuel: Fuel,
  receipt: Receipt,
  "shopping-bag": ShoppingBag,
  heart: Heart,
  "circle-ellipsis": CircleEllipsis,
  circle: Circle,
};

export const CATEGORY_ICON_KEYS = Object.keys(map);

export function categoryIcon(key: string): LucideIcon {
  return map[key] ?? Circle;
}
