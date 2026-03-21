export interface Order {
  id: string;
  createdAt: string;
  status: "new" | "in_progress" | "completed" | "shipped";
  // Client info
  email: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  // Product config
  format: "portrait" | "fullbody";
  people: number;
  animals: number;
  background: string;
  printOption: string; // "Digital" | "Portrait sur Toile" | "Poster Encadré"
  total: number;
  description: string;
  // Files
  photoUrls: string[];
  // Payment
  stripePaymentId?: string;
}

export interface Prices {
  base: number;
  fullbodyExtra: number;
  extraPerson: number;
  extraAnimal: number;
  digital: number;
  canvas: number;
  poster: number;
}

export const DEFAULT_PRICES: Prices = {
  base: 49,
  fullbodyExtra: 20,
  extraPerson: 15,
  extraAnimal: 15,
  digital: 0,
  canvas: 89,
  poster: 79,
};
