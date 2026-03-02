// =========================================================
// REPLIFY AI - CORS Utility Functions
// Section 11: Cross-Origin Resource Sharing Security
// =========================================================

/**
 * Get the list of allowed origins from environment and hardcoded defaults
 */
function getAllowedOrigins(): string[] {
  const origins = [
    "http://localhost:5173",      // Vite dev server
    "http://localhost:4173",      // Vite build preview
    "http://localhost:8080",      // Alternative dev port
    "http://localhost:3000",      // Common dev port
    "https://zzyraai.com",        // Production domain
    "https://www.zzyraai.com",    // Production www subdomain
    "http://zzyraai.com",         // HTTP production
    "http://www.zzyraai.com",     // HTTP www
  ];

  // Add FRONTEND_URL from environment if set
  const frontendUrl = Deno.env.get("FRONTEND_URL");
  if (frontendUrl && !origins.includes(frontendUrl)) {
    origins.push(frontendUrl);
  }

  return origins;
}

/**
 * Create CORS headers for a given origin
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = origin && allowedOrigins.includes(origin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature, paddle-signature",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // 24 hours
  };

  if (isAllowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

/**
 * Handle CORS preflight and return appropriate response
 * Returns a Response for OPTIONS requests, null for others
 */
export function handleCORS(req: Request): Response | null {
  const origin = req.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins();

  // Handle preflight request
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    return new Response("ok", { status: 200, headers });
  }

  // For non-OPTIONS requests, return null to continue processing
  // The response handlers will add appropriate CORS headers
  return null;
}

/**
 * Create a response with CORS headers
 */
export function createCORSResponse(req: Request, body: string, status: number, customHeaders?: Record<string, string>): Response {
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...cors,
    ...(customHeaders || {})
  };

  return new Response(body, {
    status,
    headers
  });
}

/**
 * Create an error response with CORS headers
 */
export function createErrorResponse(req: Request, message: string, status: number, errorCode: string, customHeaders?: Record<string, string>): Response {
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);

  const errorBody = JSON.stringify({
    error: message,
    errorCode,
    timestamp: new Date().toISOString()
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...cors,
    ...(customHeaders || {})
  };

  return new Response(errorBody, {
    status,
    headers
  });
}