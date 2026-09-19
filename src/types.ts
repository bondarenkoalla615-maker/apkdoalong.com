export type ViewState = 'store' | 'publish' | 'appDetails';

export type DeveloperPlan = 'none' | 'unlimited' | 'unlimited_verified';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan?: DeveloperPlan;
  planPurchasedAt?: string;
}

export interface AppItem {
  id: string;
  name: string;
  description: string;
  category: string;
  coverPhoto: string;
  isVerified: boolean;
  developer: string;
  developerId?: string;
  downloads: number;
  size: string;
  downloadUrl?: string;
  apkFileName?: string;
  paymentMethod?: string;
  paypalOrderId?: string;
  createdAt?: string;
}

export const CATEGORIES = [
  'Игры', 'Социальные', 'Утилиты', 'Развлечения', 'Фото и Видео', 'Продуктивность'
];
