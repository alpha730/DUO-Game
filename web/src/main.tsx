import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { applyBrand } from "./config/applyBrand";
import { BRAND } from "./config/brand";
import { installFeedback } from "./lib/feedback";
import "./theme.css";

applyBrand(BRAND); // colours (light + dark), fonts, title, favicon — before the first render
installFeedback(); // tap haptics + audio unlock on the first tap

// Production: the stylesheet loads without blocking the splash (vite.config.ts); render once it's in.
function stylesReady(): Promise<void> {
  const css = document.querySelector<HTMLLinkElement>("link[data-app-css]");
  if (!css || css.media === "all") return Promise.resolve(); // already applied (its onload ran)
  return new Promise((done) => {
    css.addEventListener("load", () => done(), { once: true });
    css.addEventListener("error", () => done(), { once: true });
  });
}

void stylesReady().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  ),
);
