import { describe, expect, it } from "vitest";
import { parsePrize } from "./prizes";

describe("parsePrize", () => {
  it("accepts a good prize, trimming the name", () => {
    expect(parsePrize({ name: "  DET   T-shirt ", cost: 1000, stock: 30 })).toEqual({ prize: { name: "DET T-shirt", cost: 1000, stock: 30 } });
    expect(parsePrize({ id: "tshirt", name: "T-shirt", cost: 1, stock: 0 })).toEqual({ id: "tshirt", prize: { name: "T-shirt", cost: 1, stock: 0 } });
  });
  it("refuses a missing or long name", () => {
    expect(parsePrize({ name: "  ", cost: 10, stock: 1 })).toHaveProperty("error");
    expect(parsePrize({ cost: 10, stock: 1 })).toHaveProperty("error");
    expect(parsePrize({ name: "x".repeat(61), cost: 10, stock: 1 })).toHaveProperty("error");
  });
  it("refuses bad numbers", () => {
    for (const cost of [0, -5, 1.5, "100", null, 1_000_001]) expect(parsePrize({ name: "Mug", cost, stock: 1 }), String(cost)).toHaveProperty("error");
    for (const stock of [-1, 2.5, "3", undefined, 100_001]) expect(parsePrize({ name: "Mug", cost: 10, stock }), String(stock)).toHaveProperty("error");
  });
  it("refuses a bad id", () => {
    expect(parsePrize({ id: "a/b", name: "Mug", cost: 10, stock: 1 })).toHaveProperty("error");
    expect(parsePrize({ id: "", name: "Mug", cost: 10, stock: 1 })).toHaveProperty("error");
  });
});
