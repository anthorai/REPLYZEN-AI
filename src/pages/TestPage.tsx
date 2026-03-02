import { useEffect, useState } from "react";

export default function TestPage() {
  const [status, setStatus] = useState("Loading...");
  
  useEffect(() => {
    try {
      console.log("Test page loaded");
      setStatus("Test page loaded successfully!");
      
      // Test environment variables
      console.log("VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
      console.log("VITE_SUPABASE_ANON_KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "SET" : "NOT SET");
      
      // Test if required vars are present
      if (!import.meta.env.VITE_SUPABASE_URL) {
        setStatus("ERROR: VITE_SUPABASE_URL is missing");
        return;
      }
      
      if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setStatus("ERROR: VITE_SUPABASE_ANON_KEY is missing");
        return;
      }
      
      setStatus("All environment variables are present!");
      
    } catch (error) {
      console.error("Test error:", error);
      setStatus(`ERROR: ${error.message}`);
    }
  }, []);
  
  return (
    <div style={{ 
      padding: "20px", 
      fontFamily: "monospace",
      backgroundColor: "#f5f5f5",
      minHeight: "100vh"
    }}>
      <h1>Debug Test Page</h1>
      <div>Status: {status}</div>
      <button onClick={() => window.location.reload()}>Reload Page</button>
      <div style={{ marginTop: "20px" }}>
        <h2>Environment Variables:</h2>
        <pre>
VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL || "NOT SET"}
VITE_SUPABASE_ANON_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? "SET" : "NOT SET"}
        </pre>
      </div>
    </div>
  );
}