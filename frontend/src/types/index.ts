export interface AQICategory {
  level:
    | "good"
    | "moderate"
    | "sensitive"
    | "unhealthy"
    | "very-unhealthy"
    | "hazardous"
    | "unknown";
  label: string;
  color: string;
  softColor: string;
  advice: string;
  sensitiveAdvice: string;
}

export interface Pollutant {
  key: string;
  label: string;
  value: number;
  unit: string;
  displayValue: number;
  displayUnit: string;
  guideline: number;
  guidelineUnit: string;
  percentOfGuideline: number | null;
  description: string;
}

export interface WeatherData {
  time: string | null;
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  windDirectionLabel: string;
  condition: string;
  icon: string;
  weatherCode: number | null;
  precipitation: number | null;
  cloudCover: number | null;
  pressure: number | null;
  uvIndex: number | null;
  visibilityKm: number | null;
  isDay: boolean;
  sunrise: string | null;
  sunset: string | null;
}

export interface HourlyPoint {
  time: string;
  label: string;
  aqi: number;
  pm2_5: number | null;
  pm10: number | null;
  temperature: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
  condition: string;
  icon: string;
}

export interface DailyPoint {
  date: string;
  weekday: string;
  aqiMax: number | null;
  aqiAvg: number | null;
  pm2_5Max: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
  condition: string;
  icon: string;
  uvIndexMax: number | null;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: "health" | "travel" | "home" | "indoor" | "eco" | "outdoor" | string;
  impact: string;
  priority: "high" | "medium" | "low";
  icon: string;
}

export interface OutdoorWindow {
  start: string;
  end: string;
  startLabel: string;
  endLabel: string;
  averageAqi: number;
  category: AQICategory;
}

export interface AQIInsights {
  headline: string;
  categoryLabel: string;
  bestOutdoorWindow: OutdoorWindow | null;
  cleanestHour: {
    time: string;
    label: string;
    aqi: number;
    category: AQICategory;
  } | null;
  ventilationAdvice: string;
  trend: "improving" | "worsening" | "stable";
  summary: string;
}

export interface AirLocation {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number | null;
}

export interface AirMeta {
  isDemo: boolean;
  source: string;
  attribution: string;
  fetchedAt: string;
  timezone: string;
  warnings: string[];
  notice: string | null;
  cacheTtlSeconds: number;
}

export interface AirQualityData {
  location: AirLocation;
  current: {
    time: string | null;
    aqi: number | null;
    europeanAqi: number | null;
    category: AQICategory;
    pollutants: Record<string, Pollutant>;
    weather: WeatherData | null;
  };
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  insights: AQIInsights;
  recommendations: Recommendation[];
  meta: AirMeta;
}

export interface LocationOption {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  country?: string | null;
  admin1?: string | null;
  timezone?: string | null;
}

export interface GeocodeResult extends LocationOption {
  id: string;
  population?: number | null;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "gemini" | "demo" | "fallback";
  notice?: string | null;
  disclaimer?: string;
  groundedOn?: {
    location: string | null;
    latitude: number;
    longitude: number;
    aqi: number | null;
    category: string | null;
    isDemo: boolean;
    source: string;
    fetchedAt: string;
  };
  createdAt?: string;
}

export interface AssistantResponse {
  reply: string;
  mode: "gemini" | "demo" | "fallback";
  model: string | null;
  notice: string | null;
  disclaimer: string;
  groundedOn: NonNullable<AssistantMessage["groundedOn"]>;
  generatedAt: string;
}

export interface PlannerProfile {
  occupation: "student" | "office" | "remote" | "outdoor-worker" | "homemaker" | "other";
  transport: "walk" | "cycle" | "bus" | "metro" | "two-wheeler" | "car" | "mixed";
  outdoorActivity: "walking" | "running" | "cycling" | "sports" | "none";
  activityTime: "morning" | "afternoon" | "evening";
  commuteDistanceKm: number;
  hasChildren: boolean;
  hasElderly: boolean;
}

export interface PlanItem {
  id: string;
  time: string;
  title: string;
  description: string;
  category: string;
  status: "good" | "caution" | "avoid" | "acceptable" | "unknown";
}

export interface TransportAlternative {
  id: string;
  title: string;
  description: string;
  dailyCo2SavedKg: number;
  estimatedCo2SavedKgPerWeek: number;
  assumptions: string;
  logActivityType?: ImpactActivityType;
}

export interface PlannerResult {
  location: AirLocation;
  generatedAt: string;
  summary: string;
  alerts: Array<{ level: "high" | "medium" | "low"; message: string }>;
  bestWindow: OutdoorWindow | null;
  plan: PlanItem[];
  alternatives: {
    currentMode: string;
    currentLabel: string;
    options: TransportAlternative[];
    note: string;
  };
  dataSnapshot: {
    aqi: number | null;
    category: string | null;
    pm2_5: number | null;
    weather: WeatherData | null;
    isDemo: boolean;
    source: string;
  };
  disclaimer: string;
}

export type FamilyRelation = "child" | "adult" | "elderly";

export interface FamilyMember {
  id: string;
  name: string;
  relation: FamilyRelation;
  age?: number | null;
  activity?: string | null;
}

export interface FamilyMemberAdvice {
  id: string;
  name: string;
  relation: FamilyRelation;
  relationLabel: string;
  age: number | null;
  activity: string | null;
  riskLevel: "low" | "moderate" | "high" | "very-high" | "unknown";
  headline: string;
  actions: string[];
  avoid: string[];
}

export interface FamilyAdvice {
  location: AirLocation;
  generatedAt: string;
  current: {
    aqi: number | null;
    category: AQICategory;
    weather: WeatherData | null;
    isDemo: boolean;
    source: string;
  };
  summary: string;
  household: string[];
  members: FamilyMemberAdvice[];
  disclaimer: string;
}

export interface VentilationWindow {
  start: string;
  end: string;
  startLabel: string;
  endLabel: string;
  averageAqi: number;
  durationHours: number;
}

export interface IndoorAdvice {
  location: AirLocation;
  generatedAt: string;
  current: {
    aqi: number | null;
    category: AQICategory;
    weather: WeatherData | null;
    isDemo: boolean;
    source: string;
  };
  ventilation: {
    status: "open" | "brief" | "closed";
    headline: string;
    advice: string;
    windows: VentilationWindow[];
    bestOutdoorWindow: OutdoorWindow | null;
  };
  purifier: {
    recommended: boolean;
    cadrMin: number;
    cadrMax: number;
    hasPurifier: boolean;
    notes: string[];
  };
  tips: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    cost: "free" | "low" | "medium";
    icon: string;
  }>;
  checklist: Array<{ id: string; label: string; hint: string }>;
  disclaimer: string;
}

export type ImpactActivityType =
  | "walk"
  | "cycle"
  | "bus"
  | "metro"
  | "avoided-car"
  | "remote-work";

export interface ImpactEntry {
  id: string;
  type: ImpactActivityType;
  distanceKm: number;
  date: string;
  note?: string;
  co2SavedKg: number;
  createdAt: string;
}

export interface ApiHealth {
  status: string;
  service: string;
  version: string;
  time: string;
  features: {
    geminiConfigured: boolean;
    geminiModel: string | null;
    demoMode: boolean;
    airQualityProvider: string;
    geocodingProvider: string;
  };
}
