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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
