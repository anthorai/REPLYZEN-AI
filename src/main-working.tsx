import { createRoot } from "react-dom/client";
import React from "react";

// Simple test component
const App = () => {
  return (
    <div style={{ 
      padding: "20px", 
      backgroundColor: "#f0f8ff",
      minHeight: "100vh",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1>🎉 Application Loaded Successfully!</h1>
      <p>If you can see this, the React app is working correctly.</p>
      <div style={{ marginTop: "20px" }}>
        <button 
          onClick={() => alert("Hello from Replify AI!")}
          style={{ 
            padding: "10px 20px", 
            backgroundColor: "#4CAF50", 
            color: "white", 
            border: "none", 
            borderRadius: "5px",
            cursor: "pointer",
            marginRight: "10px"
          }}
        >
          Test Button
        </button>
        <button 
          onClick={() => window.location.reload()}
          style={{ 
            padding: "10px 20px", 
            backgroundColor: "#2196F3", 
            color: "white", 
            border: "none", 
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};

// Find root element
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Render app
try {
  console.log("Starting app render...");
  createRoot(rootElement).render(<App />);
  console.log("App rendered successfully!");
} catch (error) {
  console.error("Failed to render app:", error);
  rootElement.innerHTML = `
    <div style="padding: 20px; color: red; background: #ffebee; font-family: monospace;">
      <h2>❌ Application Error</h2>
      <p>Failed to initialize application</p>
      <p>Error: ${error.message}</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">
        Reload Page
      </button>
    </div>
  `;
}