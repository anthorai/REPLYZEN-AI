import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectGmail } from "@/hooks/useGmailConnection";

interface ConnectGmailButtonProps {
  variant?: "primary" | "outline";
  className?: string;
}

const ConnectGmailButton = ({ variant = "primary", className }: ConnectGmailButtonProps) => {
  const connectGmail = useConnectGmail();

  const handleClick = () => {
    connectGmail.mutate();
  };

  return (
    <Button
      className={className}
      variant={variant === "primary" ? "default" : "outline"}
      size="lg"
      onClick={handleClick}
      disabled={connectGmail.isPending}
    >
      {connectGmail.isPending ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <Mail className="mr-2 h-5 w-5" />
      )}
      {variant === "primary" ? "Connect Gmail" : "Sign in with Google"}
    </Button>
  );
};

export default ConnectGmailButton;
