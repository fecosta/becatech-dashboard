"use client";

import { useState } from "react";
import { initials } from "@/components/Sidebar";

export interface ScholarAvatarProps {
  /** Signed photo URL, or null when no photo exists / could not be resolved. */
  src: string | null;
  /** Full name — used for alt text and the initials fallback. */
  name: string;
  /** Only "profile" (104px) exists today; a literal union so a future smaller size
   *  (e.g. a list-row avatar) is an additive change, not a rewrite. */
  size: "profile";
}

const SIZE_CLASSES: Record<ScholarAvatarProps["size"], string> = {
  profile: "h-[104px] w-[104px] rounded-[22px]",
};

/**
 * The no-photo / broken-photo visual, isolated on purpose: swapping fallback styles is
 * a change to this one function only.
 */
function AvatarFallback({ name, sizeClasses }: { name: string; sizeClasses: string }) {
  return (
    <div
      role="img"
      aria-label={`Photo of ${name} (unavailable)`}
      className={`flex shrink-0 items-center justify-center bg-linear-to-br from-purple to-green ${sizeClasses}`}
    >
      <span className="font-display text-2xl font-bold text-white">{initials(name)}</span>
    </div>
  );
}

export function ScholarAvatar({ src, name, size }: ScholarAvatarProps) {
  const [failed, setFailed] = useState(false);
  const sizeClasses = SIZE_CLASSES[size];

  if (!src || failed) {
    return <AvatarFallback name={name} sizeClasses={sizeClasses} />;
  }

  return (
    <img
      src={src}
      alt={`Photo of ${name}`}
      className={`shrink-0 object-cover ${sizeClasses}`}
      onError={() => setFailed(true)}
    />
  );
}
