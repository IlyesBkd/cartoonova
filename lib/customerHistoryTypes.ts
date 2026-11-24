export type CustomerHistoryEvent = {
  id: string; at: string | null; kind: string; title: string; source: string;
  orderIds: string[]; status: 'recorded' | 'sent' | 'scheduled' | 'uncertain' | 'failed';
  subject?: string | null; body?: string | null; details?: string | null;
};
export type CustomerHistory = {
  customer: { name: string | null; email: string };
  orders: Array<{ id: string; createdAt: string; label: string }>;
  events: CustomerHistoryEvent[]; nextCursor: string | null; warnings: string[];
};
