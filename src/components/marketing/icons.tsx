import type { IndustryGroup } from "@/lib/brand/industries";

/**
 * Small inline line-icon set for the guest flow's category picker.
 *
 * Nine icons, one per industry group — hand-drawn to match the interface's
 * existing stroke-icon language (Spinner, the modal close mark) rather than
 * pulling in an icon package for a handful of glyphs.
 */

type IconProps = { className?: string; size?: number };

function Svg({ size = 18, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const GROUP_ICONS: Record<IndustryGroup, (props: IconProps) => React.ReactElement> = {
  food: (p) => (
    <Svg {...p}>
      <path d="M4.5 8h9v5a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3V8Z" />
      <path d="M13.5 9h1.2a2 2 0 1 1 0 4h-1.2" />
      <path d="M7.2 5c0-.7.8-.9.8-1.6S7.2 2.2 7.2 1.6" />
      <path d="M10.2 5c0-.7.8-.9.8-1.6S10.2 2.2 10.2 1.6" />
    </Svg>
  ),
  retail: (p) => (
    <Svg {...p}>
      <path d="M5.5 7h9l-.8 9.5a1 1 0 0 1-1 .9H7.3a1 1 0 0 1-1-.9L5.5 7Z" />
      <path d="M7.7 7V5.3a2.3 2.3 0 0 1 4.6 0V7" />
    </Svg>
  ),
  beauty: (p) => (
    <Svg {...p}>
      <path d="M10 2.2s4.6 5.6 4.6 9a4.6 4.6 0 1 1-9.2 0c0-3.4 4.6-9 4.6-9Z" />
    </Svg>
  ),
  fashion: (p) => (
    <Svg {...p}>
      <path d="M10 4.2a1.3 1.3 0 1 0-1.3 1.3" />
      <path d="M10 5.5 3.5 10h13L10 5.5Z" />
      <path d="M3.5 13.2h13" />
    </Svg>
  ),
  services: (p) => (
    <Svg {...p}>
      <path d="M10 2.5 16 5v3.7c0 4.2-2.8 6.7-6 8.3-3.2-1.6-6-4.1-6-8.3V5l6-2.5Z" />
    </Svg>
  ),
  professional: (p) => (
    <Svg {...p}>
      <rect x="3" y="7" width="14" height="9" rx="1.5" />
      <path d="M7.2 7V5.5A1.5 1.5 0 0 1 8.7 4h2.6a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M3 11.2h14" />
    </Svg>
  ),
  property: (p) => (
    <Svg {...p}>
      <path d="M4 9.8 10 4l6 5.8" />
      <path d="M5.6 8.6v7a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1v-7" />
    </Svg>
  ),
  industry: (p) => (
    <Svg {...p}>
      <path d="M3.2 16.3V9.8l3.6 2.3V9.8l3.6 2.3V9.8l3.6 2.3V6.2h2.8v10.1H3.2Z" strokeLinejoin="round" />
    </Svg>
  ),
  creator: (p) => (
    <Svg {...p}>
      <rect x="8" y="2.5" width="4" height="7.5" rx="2" />
      <path d="M5.6 9a4.4 4.4 0 0 0 8.8 0" />
      <path d="M10 13.3v3.4" />
      <path d="M7.2 16.7h5.6" />
    </Svg>
  ),
};

export function GroupIcon({ group, className, size }: IconProps & { group: IndustryGroup }) {
  const Icon = GROUP_ICONS[group];
  return <Icon className={className} size={size} />;
}

export function SearchIcon({ className, size = 16 }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="8.6" cy="8.6" r="5.4" />
      <path d="m16.5 16.5-3.6-3.6" />
    </Svg>
  );
}

export function SparkleIcon({ className, size = 16 }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M10 2.5c.5 2.6 1.1 4 2.1 5s2.4 1.6 5 2.1c-2.6.5-4 1.1-5 2.1s-1.6 2.4-2.1 5c-.5-2.6-1.1-4-2.1-5s-2.4-1.6-5-2.1c2.6-.5 4-1.1 5-2.1s1.6-2.4 2.1-5Z"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
