import type { LingoDoc } from "../shared/types";

/**
 * [name, DET year, rarity, colour] in poster order: index = posterIndex = MindAR target index.
 * Names = the official display names (brand.ts OFFICIAL.lingoNames): every final poster shows Duo in
 * a different mood. Server messages use these stored names directly.
 */
export const LINGOS: Array<[string, string, LingoDoc["rarity"], string]> = [
  ["Rookie Duo", "2016", "common", "#58CC02"],
  ["Curious Duo", "2017", "common", "#1CB0F6"],
  ["Winking Duo", "2018", "common", "#FF9600"],
  ["Thumbs-Up Duo", "2019", "rare", "#CE82FF"],
  ["Fierce Duo", "2020", "rare", "#FF4B4B"],
  ["Lovestruck Duo", "2021", "rare", "#FFC800"],
  ["Joyful Duo", "2022", "epic", "#2B70C9"],
  ["Bookworm Duo", "2023", "epic", "#00CD9C"],
  ["Cool Duo", "2024", "legendary", "#E91E63"],
  ["Champion Duo", "2025", "legendary", "#7C4DFF"],
];

export const lingoId = (year: string) => `lingo-${year}`;
