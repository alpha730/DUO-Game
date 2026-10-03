import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { applyBrand } from "./config/applyBrand";
import { BRAND } from "./config/brand";
import "./theme.css";

applyBrand(BRAND); // colours, fonts, title, favicon — before the first render

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
