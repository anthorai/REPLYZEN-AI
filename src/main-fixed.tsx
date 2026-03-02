import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App.tsx";
import "./index.css";

// Simple error boundary component
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  if (hasError) {
    return (
      <div style={{ 
        padding: "20px", 
        color: "red", 
        fontFamily: "monospace",
        backgroundColor: "#ffebee",
        minHeight: "100vh"
      }}>
        <h2>Application Error</h2>
        <p>{error?.message || "Unknown error occurred"}</p>
        <button 
          onClick={() => {
            setHasError(false);
            setError(null);
            window.location.reload();
          }}
          style={{ 
            padding: "10px 20px", 
            backgroundColor: "#f44336", 
            color: "white", 
            border: "none", 
            borderRadius: "5px",
            cursor: "pointer",
            marginTop: "10px"
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

// Find root element
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Render app with error handling
try {
  console.log("Starting app render...");
  
  // Simple performance monitoring
  const startTime = performance.now();
  
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  
  const renderTime = performance.now() - startTime;
  console.log(`App rendered in ${renderTime.toFixed(2)}ms`);
  
} catch (error) {
  console.error("Failed to render app:", error);
  
  // Fallback UI
  rootElement.innerHTML = `
    <div style="padding: 20px; color: red; background: #ffebee; font-family: monospace; min-height: 100vh;">
      <h2>❌ Application Error</h2>
      <p>Failed to initialize application</p>
      <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
        Reload Page
      </button>
    </div>
  `;
}