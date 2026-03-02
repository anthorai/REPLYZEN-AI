import { createRoot } from "react-dom/client";
import TestPage from "./pages/TestPage.tsx";
import "./index.css";

// Simple error boundary for debugging
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  try {
    return <>{children}</>;
  } catch (error) {
    console.error("Render error:", error);
    return (
      <div style={{ 
        padding: "20px", 
        color: "red", 
        fontFamily: "monospace",
        backgroundColor: "#ffebee"
      }}>
        <h2>Application Error</h2>
        <p>{error instanceof Error ? error.message : "Unknown error"}</p>
        <button onClick={() => window.location.reload()}>Reload Page</button>
      </div>
    );
  }
};

// Simple root component
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Create root with error handling
try {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <TestPage />
    </ErrorBoundary>
  );
} catch (error) {
  console.error("Failed to render app:", error);
  rootElement.innerHTML = `
    <div style="padding: 20px; color: red; font-family: monospace; background: #ffebee;">
      <h2>Fatal Error</h2>
      <p>Failed to initialize application</p>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <button onclick="window.location.reload()">Reload Page</button>
    </div>
  `;
}