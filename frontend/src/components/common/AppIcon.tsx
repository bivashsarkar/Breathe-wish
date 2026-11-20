import {
  Activity,
  Baby,
  Bike,
  Bus,
  Car,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  CookingPot,
  Droplets,
  Factory,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Home,
  Leaf,
  PersonStanding,
  Shield,
  Snowflake,
  Sparkles,
  Sun,
  TrainFront,
  Trees,
  Users,
  Wind,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  home: Home,
  heart: HeartPulse,
  users: Users,
  bus: Bus,
  wind: Wind,
  bike: Bike,
  leaf: Leaf,
  activity: Activity,
  flame: Flame,
  sparkles: Sparkles,
  droplets: Droplets,
  cloud: Cloud,
  sun: Sun,
  "cloud-sun": CloudSun,
  fog: CloudFog,
  rain: CloudRain,
  drizzle: CloudDrizzle,
  snow: Snowflake,
  storm: CloudLightning,
  gauge: Gauge,
  baby: Baby,
  person: PersonStanding,
  cooking: CookingPot,
  car: Car,
  train: TrainFront,
  footprints: Footprints,
  factory: Factory,
  trees: Trees,
};

export default function AppIcon({
  name,
  size = 18,
  className,
  strokeWidth = 1.9,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
