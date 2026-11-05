export type Tier =
  | "premiumUrban"
  | "urbanMid"
  | "suburban"
  | "suburbanValue"
  | "regional"
  | "regionalGrowth"
  | "regionalValue";

export type Segment = "volume" | "premium" | "luxury" | "newEntrant";
export type SeasonGroup = "volume" | "premium";

export interface Store {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  tier: Tier;
  brands: string[];
  traffic: number;
  inboundCap: number;
}

export interface Brand {
  id: string;
  name: string;
  segment: Segment;
  seasonGroup: SeasonGroup;
  costRatio: number;
  launchMonth: number | null; // 1-based history month, null when established
}

export interface Model {
  id: string;
  brand: string;
  name: string;
  body: string; // dictionary key for body type
  msrpBase: number;
}

export interface World {
  seed: number;
  today: string;
  historyStart: { year: number; month: number };
  months: number;
  stores: Store[];
  brands: Brand[];
  models: Model[];
  trims: string[]; // keys: base, mid, top
  trimSteps: number[];
  colors: string[];
  /** sales[store][model][monthIndex] */
  sales: Record<string, Record<string, number[]>>;
  trimCounts: Record<string, Record<string, number[]>>;
  colorCounts: Record<string, Record<string, number[]>>;
  /** first 0-based month index the store sells the brand */
  brandStart: Record<string, Record<string, number>>;
}

export interface Unit {
  id: string;
  store: string;
  brand: string;
  model: string;
  trim: number;
  color: number;
  cost: number;
  msrp: number;
  arrival: string;
  age: number;
  storyId?: number;
}

export interface Assumptions {
  floorplanRate: number; // annual, e.g. 0.12
  weeklyCapacity: number;
  costPerKm: number;
  fixedTransferCost: number;
  maxDiscount: number; // e.g. 0.08
  minImprovement: number; // MXN
  elasticity: Record<Segment, number>;
}

export type ActionType = "keep" | "transfer" | "discount";

export interface PlanAction {
  id: string;
  unitId: string;
  type: "transfer" | "discount";
  from: string;
  to?: string;
  discount?: number;
  improvement: number; // marginal improvement accepted by the optimizer, MXN
}
