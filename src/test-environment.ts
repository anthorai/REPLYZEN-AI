// Test script to identify the specific issue
console.log("=== Environment Test ===");
console.log("Window available:", typeof window !== "undefined");
console.log("Document available:", typeof document !== "undefined");

if (typeof window !== "undefined" && typeof document !== "undefined") {
  console.log("Root element exists:", !!document.getElementById("root"));
  console.log("React DOM available:", typeof window.ReactDOM !== "undefined");
}

console.log("=== Import Test ===");
try {
  console.log("Testing React import...");
  import("react").then(() => console.log("✅ React import successful"));
} catch (e) {
  console.error("❌ React import failed:", e);
}

try {
  console.log("Testing React DOM import...");
  import("react-dom/client").then(() => console.log("✅ React DOM import successful"));
} catch (e) {
  console.error("❌ React DOM import failed:", e);
}

console.log("=== Environment Variables ===");
console.log("VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL ? "SET" : "NOT SET");
console.log("VITE_SUPABASE_ANON_KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "SET" : "NOT SET");

console.log("=== Test Complete ===");