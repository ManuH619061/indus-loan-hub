import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface LenderAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

export default function LenderAvatar({ 
  name, 
  logoUrl, 
  size = "md",
  className 
}: LenderAvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  // Reset error state when logoUrl changes
  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);
  
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const showImage = logoUrl && !imageError;

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {showImage && (
        <AvatarImage 
          src={logoUrl} 
          alt={name} 
          className="object-contain"
          onError={() => setImageError(true)}
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}