import { siFacebook, siInstagram, siTelegram, siTiktok, siX, siYoutube } from "simple-icons";
import { cn } from "@/lib/utils";

const ICONS = { x: siX, youtube: siYoutube, telegram: siTelegram, tiktok: siTiktok, instagram: siInstagram, facebook: siFacebook };

export type IconComponent = (props: { className?: string }) => React.ReactNode;

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const icon = ICONS[platform as keyof typeof ICONS];
  if (!icon) return null;
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" aria-label={icon.title} className={cn("size-4 shrink-0", className)}>
      <path d={icon.path} />
    </svg>
  );
}

export const brand =
  (platform: keyof typeof ICONS): IconComponent =>
  ({ className }) => <PlatformIcon platform={platform} className={className} />;
