import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db.json');

export interface LocalData {
  profiles: string[];
  mediaItems: any[];
  watchedEpisodes: any[];
}

export function loadDb(): LocalData {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        profiles: parsed.profiles || [],
        mediaItems: parsed.mediaItems || [],
        watchedEpisodes: parsed.watchedEpisodes || [],
      };
    }
  } catch (e) {
    console.error('[JSON DB] Failed to load local DB:', e);
  }
  return { profiles: [], mediaItems: [], watchedEpisodes: [] };
}

export function saveDb(data: LocalData) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[JSON DB] Failed to save local DB:', e);
  }
}
