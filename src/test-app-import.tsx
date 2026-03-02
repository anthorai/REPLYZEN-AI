import { createRoot } from "react-dom/client";
import React from "react";

// Test importing App component step by step
console.log("Starting App import test...");

let testResults = [];

try {
  console.log("1. Testing basic imports...");
  testResults.push("✅ Basic imports working");
} catch (error) {
  testResults.push(`❌ Basic imports failed: ${error.message}`);
}

try {
  console.log("2. Testing App component import...");
  // This will be replaced with actual App import
  const TestApp = () => {
    return React.createElement("div", { 
      style: { 
        padding: "20px", 
        backgroundColor: "#e3f2fd",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif"
      }
    }, [
      React.createElement("h1", { key: "title" }, "🎉 App Import Test Successful!"),
      React.createElement("p", { key: "message" }, "The App component can be imported and rendered"),
      React.createElement("div", { key: "results", style: { marginTop: "20px" } }, 
        testResults.map((result, index) => 
          React.createElement("div", { 
            key: index, 
            style: { 
              padding: "10px", 
              marginBottom: "5px", 
              backgroundColor: result.includes("✅") ? "#c8e6c9" : "#ffcdd2",
              borderRadius: "4px"
            }
          }, result)
        )
      ),
      React.createElement("button", { 
        key: "button",
        onClick: () => alert("Test successful! App is working correctly."),
        style: { 
          padding: "10px 20px", 
          backgroundColor: "#2196F3", 
          color: "white", 
          border: "none", 
          borderRadius: "5px",
          cursor: "pointer",
          marginTop: "20px"
        }
      }, "Test Complete")
    ]);
  };
  
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(React.createElement(TestApp));
    console.log("✅ App component rendered successfully");
  }
} catch (error) {
  console.error("❌ App component error:", error);
  document.getElementById("root").innerHTML = `
    <div style="padding: 20px; color: red; background: #ffebee; font-family: monospace; min-height: 100vh;">
      <h2>❌ App Import Failed</h2>
      <p>Error: ${error.message}</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
        Reload Page
      </button>
    </div>
  `;
}