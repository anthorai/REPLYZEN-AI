import { createRoot } from "react-dom/client";

// Minimal test - just render something to the DOM
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Simple test to see if React is working
function TestComponent() {
  return (
    <div style={{ 
      padding: "20px", 
      backgroundColor: "#e8f5e8",
      minHeight: "100vh",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1>✅ React is Working!</h1>
      <p>If you can see this, React is rendering correctly.</p>
      <button 
        onClick={() => alert("Button clicked!")}
        style={{ 
          padding: "10px 20px", 
          backgroundColor: "#007bff", 
          color: "white", 
          border: "none", 
          borderRadius: "5px",
          cursor: "pointer"
        }}
      >
        Test Button
      </button>
    </div>
  );
}

try {
  console.log("Attempting to render...");
  createRoot(rootElement).render(<TestComponent />);
  console.log("Render successful!");
} catch (error) {
  console.error("Render failed:", error);
  rootElement.innerHTML = `
    <div style="padding: 20px; color: red; background: #ffebee;">
      <h2>❌ Render Failed</h2>
      <p>${error.message}</p>
      <button onclick="window.location.reload()">Reload</button>
    </div>
  `;
}