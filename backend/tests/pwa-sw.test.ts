import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { publicNotice } from '../src/services/push.service.js';

const sw = readFileSync(path.resolve(process.cwd(), '../public/sw.js'), 'utf8');

describe('service worker médical', () => {
  it('ne met jamais en cache les réponses API', () => {
    expect(sw).toContain("url.pathname.startsWith('/api')");
    expect(sw).toContain('if (isPrivate(request, url)) return;');
    expect(sw).not.toContain("cache.put('/api");
    expect(sw).toContain("request.method !== 'GET'");
  });

  it('limite le texte affiché sur l’écran verrouillé', () => {
    const notice = publicNotice({
      title: 'Résultat de laboratoire du patient '.repeat(8),
      body: 'Hémoglobine 8 g/dL, dossier complet '.repeat(10),
      url: 'https://example.test/secret',
    });
    expect(notice.title.length).toBeLessThanOrEqual(80);
    expect(notice.body.length).toBeLessThanOrEqual(140);
    expect(notice.url).toBe('/dashboard');
  });
});
