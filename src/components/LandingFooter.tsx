import { Link } from "react-router-dom";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-muted/30 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <span className="font-semibold text-gradient-orange">Replify AI</span>
          
          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link 
              to="/privacy" 
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              to="/terms" 
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <a 
              href="mailto:support@replifyai.app" 
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>
          
          {/* Copyright */}
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Replify AI. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
