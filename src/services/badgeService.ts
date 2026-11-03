import { httpClient } from './httpClient';

export interface WorkBadges {
  counts: Record<string, number>;
}

class BadgeService {
  get() {
    return httpClient.get<WorkBadges>('/badges');
  }

  seen(ids: string[]) {
    return httpClient.post<{ success: boolean }>('/badges/seen', { ids });
  }
}

export const badgeService = new BadgeService();
