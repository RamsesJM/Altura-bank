import { describe, expect, it } from 'vitest';
import faviconSvg from '../public/favicon.svg?raw';
import manifestJson from '../public/manifest.webmanifest?raw';
import indexHtml from '../index.html?raw';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

const manifest = JSON.parse(manifestJson) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
};

const publicPngs = Object.keys(import.meta.glob('../public/*.png')).map((path) =>
  path.replace('../public', ''),
);

describe('installable app', () => {
  it('describes the app in the web manifest', () => {
    expect(manifest).toMatchObject({
      name: 'Altura Bank',
      short_name: 'Altura',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#0f3d5e',
      background_color: '#f8fafc',
    });
  });

  it('lists 192 and 512 icons plus a maskable icon that exist in public/', () => {
    expect(manifest.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
    for (const icon of manifest.icons) {
      expect(publicPngs).toContain(icon.src);
    }
    expect(publicPngs).toContain('/apple-touch-icon.png');
  });

  it('links the manifest, theme color and home screen icon from index.html', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(indexHtml).toContain('<meta name="theme-color" content="#0f3d5e" />');
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-title" content="Altura Bank" />');
  });

  it('ships a favicon with no embedded metadata', () => {
    expect(faviconSvg).not.toMatch(/<metadata/i);
    expect(faviconSvg.length).toBeLessThan(400);
  });
});
