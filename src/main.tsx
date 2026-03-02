import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App.tsx";
import "./index.css";

console.log("Main file loaded");

// Prevent permanent blank screen due to FOUC-prevention CSS:
// html:not(.fonts-loaded) body { opacity: 0; }
// Ensure the class is applied even if Font Loading API is unavailable.
if (typeof document !== "undefined") {
  const rootEl = document.documentElement;
  const markFontsLoaded = () => rootEl.classList.add("fonts-loaded");
  const fonts = (document as any).fonts;
  if (fonts && typeof fonts.ready?.then === "function") {
    fonts.ready.then(markFontsLoaded).catch(markFontsLoaded);
  } else {
    markFontsLoaded();
  }
}

// Simple error boundary for immediate error catching
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  if (hasError) {
    return (
      <div style={{ 
        padding: "40px", 
        color: "red", 
        fontFamily: "monospace",
        backgroundColor: "#ffebee",
        minHeight: "100vh",
        textAlign: "center"
      }}>
        <h2>❌ Application Error</h2>
        <p>{error?.message || "Unknown error occurred"}</p>
        <button 
          onClick={() => {
            setHasError(false);
            setError(null);
            window.location.reload();
          }}
          style={{ 
            padding: "12px 24px", 
            backgroundColor: "#f44336", 
            color: "white", 
            border: "none", 
            borderRadius: "6px",
            cursor: "pointer",
            marginTop: "20px",
            fontSize: "16px"
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

console.log("Root element found, rendering app...");

// Wrap app with error boundary to catch any mounting errors
createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

console.log("App render initiated");
