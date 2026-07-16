export interface Product {
  id: string;
  name: string;
  prefix: string;
  createdAt?: string;
}

export interface Plan {
  id: string;
  productId: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  deviceLimit: number;
  featuresJson: string[] | string;
  billingPeriod: string;
  isActive: boolean;
  createdAt?: string;
  moduleId?: string | null;
  serviceCode?: string | null;
}
