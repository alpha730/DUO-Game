import { describe, expect, it } from "vitest";
import { allowedOrigins, isAllowedOrigin } from "./origins";

describe("allowedOrigins", () => {
  const prod = allowedOrigins("decade-hunt-66f6e", false);
  const emu = allowedOrigins("demo-decade-hunt", true);

  it("allows only the project's Hosting domains in production", () => {
    expect(isAllowedOrigin("https://decade-hunt-66f6e.web.app", prod)).toBe(true);
    expect(isAllowedOrigin("https://decade-hunt-66f6e.firebaseapp.com", prod)).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", prod)).toBe(false);
    expect(isAllowedOrigin("https://evil.example", prod)).toBe(false);
    expect(isAllowedOrigin("https://decade-hunt-66f6e.web.app.evil.example", prod)).toBe(false);
    expect(isAllowedOrigin("http://decade-hunt-66f6e.web.app", prod)).toBe(false);
  });
  it("adds localhost on the emulator", () => {
    expect(isAllowedOrigin("http://localhost:5173", emu)).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:5000", emu)).toBe(true);
    expect(isAllowedOrigin("http://localhost.evil.example", emu)).toBe(false);
  });
});
