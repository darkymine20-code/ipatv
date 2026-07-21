import { GoogleGenAI } from "@google/genai";

export interface SeedrFile {
  id: number;
  name: string;
  size: number;
  streamUrl?: string;
  folderId?: number;
}

export interface SeedrTorrent {
  id: number;
  name: string;
  progress: number;
  status: string;
  hash?: string;
}

export interface SeedrStatusResponse {
  status: 'ready' | 'downloading' | 'not_added' | 'error';
  progress?: number;
  files?: SeedrFile[];
  message?: string;
}

/**
 * Custom Seedr API Client using standard native fetch
 */
export class SeedrClient {
  private email: string;
  private password: string;
  private token: string | null = null;

  constructor() {
    this.email = process.env.SEEDR_EMAIL || "hawremhamad2026@gmail.com";
    this.password = process.env.SEEDR_PASSWORD || "19711971";
  }

  async login(): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('grant_type', 'password');
      formData.append('client_id', 'seedr_chrome');
      formData.append('type', 'login');
      formData.append('username', this.email);
      formData.append('password', this.password);

      const response = await fetch('https://www.seedr.cc/oauth_test/token.php', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Seedr login failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!data.access_token) {
        throw new Error("No access token returned from Seedr");
      }

      this.token = data.access_token;
      return this.token;
    } catch (error: any) {
      console.error("Seedr Client Login Error:", error);
      throw error;
    }
  }

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    return this.login();
  }

  async getRootContents(): Promise<{ folders: any[]; files: any[]; torrents: any[] }> {
    const token = await this.ensureToken();
    try {
      const response = await fetch(`https://www.seedr.cc/api/folder?access_token=${token}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch root folder, status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      this.token = null;
      const rToken = await this.ensureToken();
      const response = await fetch(`https://www.seedr.cc/api/folder?access_token=${rToken}`);
      return await response.json();
    }
  }

  async getFolderContents(folderId: number): Promise<{ folders: any[]; files: any[] }> {
    const token = await this.ensureToken();
    const response = await fetch(`https://www.seedr.cc/api/folder/${folderId}?access_token=${token}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch folder ${folderId}, status: ${response.status}`);
    }
    return await response.json();
  }

  async addMagnet(magnet: string): Promise<any> {
    const token = await this.ensureToken();
    const formData = new FormData();
    formData.append('access_token', token);
    formData.append('func', 'add_torrent');
    formData.append('torrent_magnet', magnet);

    const response = await fetch('https://www.seedr.cc/oauth_test/resource.php', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error("Torrent is too large for your Seedr account limit (free accounts are limited to 2GB). Try choosing a smaller single-episode stream or a lower resolution (720p/480p).");
      }
      throw new Error(`Failed to add magnet, status: ${response.status}`);
    }

    return await response.json();
  }

  async getFileStreamUrl(fileId: number): Promise<string> {
    const token = await this.ensureToken();
    const formData = new FormData();
    formData.append('access_token', token);
    formData.append('func', 'fetch_file');
    formData.append('folder_file_id', fileId.toString());

    const response = await fetch('https://www.seedr.cc/oauth_test/resource.php', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file stream details, status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.url) {
      throw new Error(`Seedr did not return a stream URL for file ID ${fileId}`);
    }

    return data.url;
  }

  async deleteItem(type: 'file' | 'folder' | 'torrent', id: number): Promise<any> {
    const token = await this.ensureToken();
    const formData = new FormData();
    formData.append('access_token', token);
    formData.append('func', 'delete');
    
    const deleteType = type === 'torrent' ? 'torrent' : type;
    formData.append('delete_arr', JSON.stringify([{
      type: deleteType,
      id: id
    }]));

    const response = await fetch('https://www.seedr.cc/oauth_test/resource.php', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete item ${type}:${id}, status: ${response.status}`);
    }

    return await response.json();
  }

  async clearAllContents(): Promise<void> {
    try {
      const root = await this.getRootContents();
      
      if (root.torrents && Array.isArray(root.torrents)) {
        for (const t of root.torrents) {
          await this.deleteItem('torrent', t.id).catch(e => console.error(e));
        }
      }

      if (root.folders && Array.isArray(root.folders)) {
        for (const f of root.folders) {
          await this.deleteItem('folder', f.id).catch(e => console.error(e));
        }
      }

      if (root.files && Array.isArray(root.files)) {
        for (const f of root.files) {
          await this.deleteItem('file', f.id).catch(e => console.error(e));
        }
      }
    } catch (error) {
      console.error("Error clearing Seedr contents:", error);
    }
  }

  private normalizeString(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private parseMediaTitle(rawTitle: string) {
    const clean = rawTitle.toLowerCase().replace(/[\.\_\-\[\]\(\)\{\}\+\/]/g, ' ').trim();
    
    const s01e05Match = clean.match(/\bS(\d+)E(\d+)\b/i) || clean.match(/\bS(\d+)\s*Ep?(\d+)\b/i);
    if (s01e05Match) {
      const season = parseInt(s01e05Match[1], 10);
      const episode = parseInt(s01e05Match[2], 10);
      const idx = clean.indexOf(s01e05Match[0]);
      const coreTitle = clean.substring(0, idx).trim().replace(/[^a-z0-9]/g, '');
      return { isShow: true, coreTitle, season, episode, year: undefined as number | undefined };
    }

    const s01Match = clean.match(/\bS(\d+)\b/i) || clean.match(/\bSeason\s*(\d+)\b/i);
    if (s01Match) {
      const season = parseInt(s01Match[1], 10);
      const idx = clean.indexOf(s01Match[0]);
      const coreTitle = clean.substring(0, idx).trim().replace(/[^a-z0-9]/g, '');
      return { isShow: true, coreTitle, season, episode: undefined as number | undefined, year: undefined as number | undefined };
    }

    const yearMatch = clean.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      const idx = clean.indexOf(yearMatch[0]);
      const coreTitle = clean.substring(0, idx).trim().replace(/[^a-z0-9]/g, '');
      return { isShow: false, coreTitle, season: undefined as number | undefined, episode: undefined as number | undefined, year };
    }

    const coreTitle = clean.replace(/[^a-z0-9]/g, '');
    return { isShow: false, coreTitle, season: undefined as number | undefined, episode: undefined as number | undefined, year: undefined as number | undefined };
  }

  private titlesMatch(titleA: string, titleB: string): boolean {
    if (!titleA || !titleB) return false;
    
    const normA = this.normalizeString(titleA);
    const normB = this.normalizeString(titleB);
    
    if (!normA || !normB) return false;

    const genericFolders = [
      's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10',
      's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10',
      'season1', 'season2', 'season3', 'season4', 'season5', 'season6', 'season7', 'season8', 'season9', 'season10',
      'downloads', 'myfiles', 'torrents', 'media', 'videos', 'movies', 'tvshows'
    ];
    if (genericFolders.includes(normA) || genericFolders.includes(normB)) {
      return normA === normB;
    }

    const parsedA = this.parseMediaTitle(titleA);
    const parsedB = this.parseMediaTitle(titleB);

    if (parsedA.coreTitle && parsedB.coreTitle) {
      const genericCores = ['the', 'season', 'complete', 'episode', 'series', 'show'];
      if (genericCores.includes(parsedA.coreTitle) || genericCores.includes(parsedB.coreTitle)) {
        if (parsedA.coreTitle !== parsedB.coreTitle) return false;
      }

      const titlesMatchBase = parsedA.coreTitle === parsedB.coreTitle || 
                              parsedA.coreTitle.includes(parsedB.coreTitle) || 
                              parsedB.coreTitle.includes(parsedA.coreTitle);
      
      if (titlesMatchBase) {
        if (parsedA.isShow || parsedB.isShow) {
          if (parsedA.season !== undefined && parsedB.season !== undefined) {
            if (parsedA.season !== parsedB.season) return false;
            
            if (parsedA.episode !== undefined && parsedB.episode !== undefined) {
              return parsedA.episode === parsedB.episode;
            }
            return true;
          }
          const hasS1 = /s01|s1\b/i.test(titleA) || /s01|s1\b/i.test(titleB);
          const hasS2 = /s02|s2\b/i.test(titleA) || /s02|s2\b/i.test(titleB);
          const hasS3 = /s03|s3\b/i.test(titleA) || /s03|s3\b/i.test(titleB);
          if ((hasS1 && hasS2) || (hasS1 && hasS3) || (hasS2 && hasS3)) return false;

          return parsedA.coreTitle === parsedB.coreTitle;
        } else {
          if (parsedA.year !== undefined && parsedB.year !== undefined) {
            return parsedA.year === parsedB.year;
          }
          return true;
        }
      }
    }
    
    if (normA === normB) return true;
    
    const minLength = Math.min(normA.length, normB.length);
    if (minLength >= 5) {
      if (normA.includes(normB) || normB.includes(normA)) {
        const hasS1 = /s01|s1\b/i.test(titleA) || /s01|s1\b/i.test(titleB);
        const hasS2 = /s02|s2\b/i.test(titleA) || /s02|s2\b/i.test(titleB);
        const hasS3 = /s03|s3\b/i.test(titleA) || /s03|s3\b/i.test(titleB);
        if ((hasS1 && hasS2) || (hasS1 && hasS3) || (hasS2 && hasS3)) return false;

        return true;
      }
    }
    
    return false;
  }

  private strictTitlesMatch(titleA: string, titleB: string): boolean {
    if (!titleA || !titleB) return false;
    
    const normA = this.normalizeString(titleA);
    const normB = this.normalizeString(titleB);
    
    if (!normA || !normB) return false;
    
    return normA === normB || normA.includes(normB) || normB.includes(normA);
  }

  private async getAllVideoFilesRecursively(folderId: number): Promise<any[]> {
    let allVideoFiles: any[] = [];
    try {
      const folderDetails = await this.getFolderContents(folderId);
      
      if (folderDetails.files && Array.isArray(folderDetails.files)) {
        const videoFiles = folderDetails.files.filter(file => {
          const extension = (file.name || '').split('.').pop()?.toLowerCase() || '';
          const isVideoExt = ['mkv', 'mp4', 'avi', 'mov', 'webm', 'ts', 'm4v', 'flv', 'wmv'].includes(extension);
          const isLargeFile = (file.size || 0) > 50 * 1024 * 1024;
          return file.play_video || isVideoExt || isLargeFile;
        });
        allVideoFiles = allVideoFiles.concat(videoFiles);
      }
      
      if (folderDetails.folders && Array.isArray(folderDetails.folders)) {
        for (const subFolder of folderDetails.folders) {
          const subFiles = await this.getAllVideoFilesRecursively(subFolder.id);
          allVideoFiles = allVideoFiles.concat(subFiles);
        }
      }
    } catch (err) {
      console.error(`Error in getAllVideoFilesRecursively for folder ${folderId}:`, err);
    }
    return allVideoFiles;
  }

  async checkStreamStatus(infoHash: string, title: string): Promise<SeedrStatusResponse> {
    try {
      const root = await this.getRootContents();
      const cleanInfoHash = infoHash.toLowerCase().trim();

      if (root.torrents && Array.isArray(root.torrents)) {
        let matchingTorrent = root.torrents.find(t => {
          const tHash = (t.hash || t.info_hash || '').toLowerCase().trim();
          if (tHash && tHash === cleanInfoHash) return true;
          return this.strictTitlesMatch(t.name || '', title);
        });

        if (!matchingTorrent) {
          matchingTorrent = root.torrents.find(t => {
            return this.titlesMatch(t.name || '', title);
          });
        }

        if (matchingTorrent) {
          let progress = 0;
          if (matchingTorrent.progress !== undefined) {
            progress = matchingTorrent.progress;
          } else if (matchingTorrent.percent_done !== undefined) {
            progress = matchingTorrent.percent_done;
          }
          return {
            status: 'downloading',
            progress: progress,
            message: `Torrent is currently fetching in Seedr: ${matchingTorrent.name || 'Downloading'}`
          };
        }
      }

      if (root.files && Array.isArray(root.files)) {
        let matchingFile = root.files.find(f => {
          return this.strictTitlesMatch(f.name || '', title);
        });

        if (!matchingFile) {
          matchingFile = root.files.find(f => {
            return this.titlesMatch(f.name || '', title);
          });
        }

        if (matchingFile) {
          try {
            const streamUrl = await this.getFileStreamUrl(matchingFile.id);
            return {
              status: 'ready',
              files: [{
                id: matchingFile.id,
                name: matchingFile.name,
                size: matchingFile.size || 0,
                streamUrl
              }]
            };
          } catch (e) {
            console.error(e);
          }
        }
      }

      if (root.folders && Array.isArray(root.folders)) {
        let matchingFolders = root.folders.filter(folder => {
          return this.strictTitlesMatch(folder.name || '', title);
        });

        if (matchingFolders.length === 0) {
          matchingFolders = root.folders.filter(folder => {
            return this.titlesMatch(folder.name || '', title);
          });
        }

        if (matchingFolders.length > 0) {
          const allFoundFiles: SeedrFile[] = [];

          for (const folder of matchingFolders) {
            try {
              const videoFiles = await this.getAllVideoFilesRecursively(folder.id);

              for (const file of videoFiles) {
                try {
                  const streamUrl = await this.getFileStreamUrl(file.folder_file_id);
                  allFoundFiles.push({
                    id: file.folder_file_id,
                    name: file.name,
                    size: file.size || 0,
                    streamUrl,
                    folderId: folder.id
                  });
                } catch (err) {
                  console.error(`Error getting stream URL for file ${file.name}:`, err);
                }
              }
            } catch (err) {
              console.error(`Error crawling folder ${folder.name}:`, err);
            }
          }

          if (allFoundFiles.length > 0) {
            return {
              status: 'ready',
              files: allFoundFiles
            };
          }
        }
      }

      return {
        status: 'not_added',
        message: 'Stream not found in Seedr account'
      };
    } catch (error: any) {
      console.error("Error checking stream status in Seedr:", error);
      return {
        status: 'error',
        message: error.message || 'Error communicating with Seedr'
      };
    }
  }
}

const defaultSeedrClient = new SeedrClient();

export async function checkSeedrStatusDirect(infoHash: string, title: string): Promise<SeedrStatusResponse> {
  try {
    const response = await fetch(`/api/seedr/status?infoHash=${infoHash}&title=${encodeURIComponent(title)}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {}

  return await defaultSeedrClient.checkStreamStatus(infoHash, title);
}

export async function addSeedrStreamDirect(magnet: string, infoHash: string, title: string): Promise<SeedrStatusResponse> {
  try {
    const response = await fetch(`/api/seedr/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnet, infoHash, title })
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {}

  const currentStatus = await defaultSeedrClient.checkStreamStatus(infoHash, title);
  if (currentStatus.status === 'ready' || currentStatus.status === 'downloading') {
    return currentStatus;
  }
  await defaultSeedrClient.clearAllContents();
  await defaultSeedrClient.addMagnet(magnet);
  return await defaultSeedrClient.checkStreamStatus(infoHash, title);
}
