import { createRoot } from "react-dom/client";
import { lazy, StrictMode, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import { GlobalStyle } from "@/lib/styles";
import { GAME_THEME } from "@/lib/theme";
import "@/index.css";

const SandboxPage = lazy(() => import("@/pages/Sandbox").then(({ SandboxPage }) => ({ default: SandboxPage })));

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ThemeProvider theme={GAME_THEME}>
      <GlobalStyle />
      <BrowserRouter basename="/sandbox">
        <Suspense fallback={<div style={{ position: "fixed", inset: 0, display: "grid", placeContent: "center", gap: 12, textAlign: "center", background: "#203b34", color: "#eddec1" }}><strong style={{ font: "32px Georgia,serif" }}>Исток</strong><span style={{ fontSize: 12 }}>…</span></div>}>
          <Routes>
            <Route path="*" element={<SandboxPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
