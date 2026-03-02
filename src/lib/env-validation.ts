/**
 * Environment variable validation and configuration
 * Prevents runtime errors from missing environment variables
 * Uses lazy validation to avoid blocking app startup
 */

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  FRONTEND_URL: string;
  OPENAI_API_KEY?: string;
  BREVO_API_KEY?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  PADDLE_API_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  PADDLE_VENDOR_ID?: string;
  PADDLE_PUBLIC_KEY?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REDIRECT_URI?: string;
}

const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;
const optionalVars = ['VITE_RAZORPAY_KEY_ID', 'VITE_PADDLE_VENDOR_ID', 'VITE_PADDLE_PUBLIC_KEY', 'VITE_OPENAI_API_KEY', 'VITE_BREVO_API_KEY'] as const;

let cachedConfig: EnvConfig | null = null;
let validationError: Error | null = null;

function validateEnvVar(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvVar(name: string): string | undefined {
  return import.meta.env[name];
}

export function validateEnvironment(): EnvConfig {
  // Return cached config if already validated
  if (cachedConfig) {
    return cachedConfig;
  }
  
  // Return cached error if validation already failed
  if (validationError) {
    throw validationError;
  }

  try {
    // Validate required variables
    const required = requiredVars.reduce((acc, varName) => {
      const key = varName.replace('VITE_', '');
      acc[key as keyof Omit<EnvConfig, 'FRONTEND_URL'>] = validateEnvVar(varName);
      return acc;
    }, {} as Partial<EnvConfig>);

    // Get optional variables
    const optional = optionalVars.reduce((acc, varName) => {
      const key = varName.replace('VITE_', '');
      const value = getEnvVar(varName);
      if (value) {
        acc[key as keyof EnvConfig] = value;
      }
      return acc;
    }, {} as Partial<EnvConfig>);

    // Get frontend URL with fallback
    const frontendUrl = getEnvVar('VITE_FRONTEND_URL') || window.location.origin;

    const config = {
      ...required,
      ...optional,
      FRONTEND_URL: frontendUrl,
    } as EnvConfig;
    
    // Cache successful validation
    cachedConfig = config;
    return config;
    
  } catch (error) {
    console.error('Environment validation failed:', error);
    validationError = error instanceof Error ? error : new Error(String(error));

    throw validationError;
  }
}

// Lazy initialization - only validate when actually needed
export function getEnvConfig(): EnvConfig {
  return validateEnvironment();
}

export function isEnvironmentValid(): boolean {
  try {
    validateEnvironment();
    return true;
  } catch {
    return false;
  }
}

// For backward compatibility
export const envConfig = new Proxy({} as EnvConfig, {
  get(_, prop) {
    const config = validateEnvironment();
    return (config as any)[prop];
  }
});
