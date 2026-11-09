import { useState, useEffect } from 'react';

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
  platform: 'mac' | 'win' | 'linux' | 'other';
}

export interface LatestRelease {
  version: string;
  publishedAt: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
  macDownloadUrl?: string;
  winDownloadUrl?: string;
  linuxDownloadUrl?: string;
}

export function useGitHubRelease() {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRelease() {
      try {
        const res = await fetch(
          'https://api.github.com/repos/Yamato-JARVIS01/novel-studio/releases/latest'
        );
        if (!res.ok) {
          throw new Error('No release found');
        }
        const data = await res.json();
        const assets: ReleaseAsset[] = (data.assets || []).map((a: any) => {
          let platform: 'mac' | 'win' | 'linux' | 'other' = 'other';
          const nameLower = a.name.toLowerCase();
          if (nameLower.endsWith('.dmg') || nameLower.includes('darwin') || nameLower.includes('mac')) {
            platform = 'mac';
          } else if (nameLower.endsWith('.exe') || nameLower.endsWith('.msi')) {
            platform = 'win';
          } else if (nameLower.endsWith('.appimage') || nameLower.endsWith('.deb')) {
            platform = 'linux';
          }
          return {
            name: a.name,
            downloadUrl: a.browser_download_url,
            size: a.size,
            platform,
          };
        });

        const macAsset = assets.find((a) => a.platform === 'mac');
        const winAsset = assets.find((a) => a.platform === 'win');
        const linuxAsset = assets.find((a) => a.platform === 'linux');

        setRelease({
          version: data.tag_name || 'v0.1.0',
          publishedAt: data.published_at ? data.published_at.slice(0, 10) : '',
          htmlUrl: data.html_url || 'https://github.com/Yamato-JARVIS01/novel-studio/releases',
          assets,
          macDownloadUrl: macAsset?.downloadUrl,
          winDownloadUrl: winAsset?.downloadUrl,
          linuxDownloadUrl: linuxAsset?.downloadUrl,
        });
      } catch {
        // Fallback info when releases are not yet published
        setRelease({
          version: 'v0.1.0',
          publishedAt: '2026-11',
          htmlUrl: 'https://github.com/Yamato-JARVIS01/novel-studio/releases',
          assets: [],
          macDownloadUrl: 'https://github.com/Yamato-JARVIS01/novel-studio/releases',
          winDownloadUrl: 'https://github.com/Yamato-JARVIS01/novel-studio/releases',
          linuxDownloadUrl: 'https://github.com/Yamato-JARVIS01/novel-studio/releases',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchRelease();
  }, []);

  return { release, isLoading };
}
