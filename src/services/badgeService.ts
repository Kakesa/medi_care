import { httpClient } from './httpClient';

export interface WorkBadges {
  counts: Record<string, number>;
}

class BadgeService {
  get() {
    return httpClient.get<WorkBadges>('/badges');
  }

  seen(ids: string[], resource: 'exam' | 'invoice' = 'exam') {
    return httpClient.post<{ success: boolean }>('/badges/seen', { ids, resource });
  }
}

export const badgeService = new BadgeService();
