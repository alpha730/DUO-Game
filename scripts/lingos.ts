import type { LingoDoc } from "../shared/types";

/** [name, DET year, rarity, colour] in poster order: index = posterIndex = MindAR target index. */
export const LINGOS: Array<[string, string, LingoDoc["rarity"], string]> = [
  ["Pip", "2016", "common", "#58CC02"],
  ["Ziggy", "2017", "common", "#1CB0F6"],
  ["Bloop", "2018", "common", "#FF9600"],
  ["Echo", "2019", "rare", "#CE82FF"],
  ["Nova", "2020", "rare", "#FF4B4B"],
  ["Remy", "2021", "rare", "#FFC800"],
  ["Quill", "2022", "epic", "#2B70C9"],
  ["Sage", "2023", "epic", "#00CD9C"],
  ["Lumo", "2024", "legendary", "#E91E63"],
  ["Decka", "2025", "legendary", "#7C4DFF"],
];

export const lingoId = (year: string) => `lingo-${year}`;
