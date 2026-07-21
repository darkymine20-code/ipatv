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

  /**
   * Logs in to Seedr and retrieves an access token
   */
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

  /**
   * Fetches all contents from the seedr account
   */
  async getRootContents(): Promise<{ folders: any[]; files: any[]; torrents: any[] }> {
    const token = await this.ensureToken();
    try {
      const response = await fetch(`https://www.seedr.cc/api/folder?access_token=${token}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch root folder, status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Seedr getRootContents error:", error);
      // If token expired, try logging in again
      this.token = null;
      const rToken = await this.ensureToken();
      const response = await fetch(`https://www.seedr.cc/api/folder?access_token=${rToken}`);
      return await response.json();
    }
  }

  /**
   * Fetches files inside a specific folder
   */
  async getFolderContents(folderId: number): Promise<{ folders: any[]; files: any[] }> {
    const token = await this.ensureToken();
    const response = await fetch(`https://www.seedr.cc/api/folder/${folderId}?access_token=${token}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch folder ${folderId}, status: ${response.status}`);
    }
    return await response.json();
  }

  /**
   * Adds a magnet link to the Seedr account
   */
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

  /**
   * Fetches the direct streaming link for a specific file ID
   */
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

  /**
   * Deletes a folder, file, or active torrent queue item
   */
  async deleteItem(type: 'file' | 'folder' | 'torrent', id: number): Promise<any> {
    const token = await this.ensureToken();
    const formData = new FormData();
    formData.append('access_token', token);
    formData.append('func', 'delete');
    
    // In Seedr, active queue items are often deleted with type: 'torrent' or type: 'active_torrent'
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

  /**
   * Clears all root files, folders, and torrents in the account to free up space
   */
  async clearAllContents(): Promise<void> {
    try {
      const root = await this.getRootContents();
      
      // Delete all active torrent downloads in progress
      if (root.torrents && Array.isArray(root.torrents)) {
        for (const t of root.torrents) {
          console.log(`Clearing active torrent queue item: ${t.name} (ID: ${t.id})`);
          await this.deleteItem('torrent', t.id).catch(e => console.error(e));
        }
      }

      // Delete all root folders
      if (root.folders && Array.isArray(root.folders)) {
        for (const f of root.folders) {
          console.log(`Clearing root folder: ${f.name} (ID: ${f.id})`);
          await this.deleteItem('folder', f.id).catch(e => console.error(e));
        }
      }

      // Delete all root files
      if (root.files && Array.isArray(root.files)) {
        for (const f of root.files) {
          console.log(`Clearing root file: ${f.name} (ID: ${f.id})`);
          await this.deleteItem('file', f.id).catch(e => console.error(e));
        }
      }
    } catch (error) {
      console.error("Error clearing Seedr contents:", error);
    }
  }

  /**
   * Normalizes a filename/title for reliable comparison
   */
  private normalizeString(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents/diacritics
      .replace(/[^a-z0-9]/g, '')       // remove other non-alphanumeric chars
      .trim();
  }

  /**
   * Cleans and strips common torrent tags/metadata to isolate the core title and year
   */
  private cleanTorrentTitle(title: string): string {
    let clean = title.toLowerCase();
    
    // Replace dots, underscores, dashes, brackets with spaces to create clear word boundaries
    clean = clean.replace(/[\.\_\-\[\]\(\)\{\}\+\/]/g, ' ');
    
    // Words/tags to remove
    const tagsToRemove = [
      '1080p', '720p', '480p', '360p', '2160p', '4k', '3d',
      'bluray', 'brrip', 'bdrip', 'dvdrip', 'webdl', 'webrip', 'web', 'hdtv', 'hdrip', 'screener', 'camrip', 'cam',
      'x264', 'h264', 'x265', 'hevc', 'divx', 'xvid',
      'yify', 'yts', 'ytsmx', 'psa', 'galaxyrg', 'tgx', 'rarbg', 'eztv', 'yoku', 'qxr', 'utr',
      'aac', 'dts', 'dd51', 'ac3', 'dualaudio', 'multiaudio', 'multi', 'dual', 'atmos', 'truehd',
      'sub', 'subs', 'subbed', 'dubbed', 'imax', 'extended', 'directoricut', 'unrated', 'remastered',
      'rpp', 'ita', 'eng', 'fre', 'rus', 'ger', 'spa', 'fra', 'deu', 'rd'
    ];
    
    // Remove tags as whole words
    for (const tag of tagsToRemove) {
      const regex = new RegExp(`\\b${tag}\\b`, 'gi');
      clean = clean.replace(regex, ' ');
    }
    
    // Finally, normalize what remains by removing all non-alphanumeric characters
    return clean.replace(/[^a-z0-9]/g, '').trim();
  }

  /**
   * Parses media titles to extract core title, show status, season, and episode.
   */
  private parseMediaTitle(rawTitle: string) {
    const clean = rawTitle.toLowerCase().replace(/[\.\_\-\[\]\(\)\{\}\+\/]/g, ' ').trim();
    
    // S01E05 style matching
    const s01e05Match = clean.match(/\bS(\d+)E(\d+)\b/i) || clean.match(/\bS(\d+)\s*Ep?(\d+)\b/i);
    if (s01e05Match) {
      const season = parseInt(s01e05Match[1], 10);
      const episode = parseInt(s01e05Match[2], 10);
      const idx = clean.indexOf(s01e05Match[0]);
      const coreTitle = clean.substring(0, idx).trim().replace(/[^a-z0-9]/g, '');
      return { isShow: true, coreTitle, season, episode, year: undefined as number | undefined };
    }

    // S01 or Season 1 Pack style matching
    const s01Match = clean.match(/\bS(\d+)\b/i) || clean.match(/\bSeason\s*(\d+)\b/i);
    if (s01Match) {
      const season = parseInt(s01Match[1], 10);
      const idx = clean.indexOf(s01Match[0]);
      const coreTitle = clean.substring(0, idx).trim().replace(/[^a-z0-9]/g, '');
      return { isShow: true, coreTitle, season, episode: undefined as number | undefined, year: undefined as number | undefined };
    }

    // Movie release year matching
    const yearMatch = clean.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      const idx = clean.indexOf(yearMatch[0]);
      const coreTitle = clean.substring(0, idx).trim().replace(/[^a-z0-9]/g, '');
      return { isShow: false, coreTitle, season: undefined as number | undefined, episode: undefined as number | undefined, year };
    }

    // Fallback simple alphanumeric title
    const coreTitle = clean.replace(/[^a-z0-9]/g, '');
    return { isShow: false, coreTitle, season: undefined as number | undefined, episode: undefined as number | undefined, year: undefined as number | undefined };
  }

  /**
   * Robust title matching helper
   */
  private titlesMatch(titleA: string, titleB: string): boolean {
    if (!titleA || !titleB) return false;
    
    const normA = this.normalizeString(titleA);
    const normB = this.normalizeString(titleB);
    
    if (!normA || !normB) return false;

    // Reject extremely short or generic folders like "S01", "S1", "Season 1", "Downloads"
    const genericFolders = [
      's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10',
      's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10',
      'season1', 'season2', 'season3', 'season4', 'season5', 'season6', 'season7', 'season8', 'season9', 'season10',
      'downloads', 'myfiles', 'torrents', 'media', 'videos', 'movies', 'tvshows'
    ];
    if (genericFolders.includes(normA) || genericFolders.includes(normB)) {
      return normA === normB;
    }

    // Intelligent structure-aware match for seasons and episodes
    const parsedA = this.parseMediaTitle(titleA);
    const parsedB = this.parseMediaTitle(titleB);

    if (parsedA.coreTitle && parsedB.coreTitle) {
      const genericCores = ['the', 'season', 'complete', 'episode', 'series', 'show'];
      if (genericCores.includes(parsedA.coreTitle) || genericCores.includes(parsedB.coreTitle)) {
        if (parsedA.coreTitle !== parsedB.coreTitle) return false;
      }

      // Titles must have a matching base core
      const titlesMatchBase = parsedA.coreTitle === parsedB.coreTitle || 
                              parsedA.coreTitle.includes(parsedB.coreTitle) || 
                              parsedB.coreTitle.includes(parsedA.coreTitle);
      
      if (titlesMatchBase) {
        if (parsedA.isShow || parsedB.isShow) {
          // If both specify seasons, they must match exactly
          if (parsedA.season !== undefined && parsedB.season !== undefined) {
            if (parsedA.season !== parsedB.season) return false;
            
            // If both specify specific episodes, those episodes must match
            if (parsedA.episode !== undefined && parsedB.episode !== undefined) {
              return parsedA.episode === parsedB.episode;
            }
            return true;
          }
          // If only one has season, verify they don't contradict (e.g. S01 vs S02 in raw names)
          const hasS1 = /s01|s1\b/i.test(titleA) || /s01|s1\b/i.test(titleB);
          const hasS2 = /s02|s2\b/i.test(titleA) || /s02|s2\b/i.test(titleB);
          const hasS3 = /s03|s3\b/i.test(titleA) || /s03|s3\b/i.test(titleB);
          if ((hasS1 && hasS2) || (hasS1 && hasS3) || (hasS2 && hasS3)) return false;

          return parsedA.coreTitle === parsedB.coreTitle;
        } else {
          // If both are movies, verify release year if present
          if (parsedA.year !== undefined && parsedB.year !== undefined) {
            return parsedA.year === parsedB.year;
          }
          return true;
        }
      }
    }
    
    // Direct or substring match on normalized names as final fallback (if length is safe)
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

  /**
   * Strict title matching helper to ensure precise release matches (e.g. 1080p vs 720p)
   */
  private strictTitlesMatch(titleA: string, titleB: string): boolean {
    if (!titleA || !titleB) return false;
    
    const normA = this.normalizeString(titleA);
    const normB = this.normalizeString(titleB);
    
    if (!normA || !normB) return false;
    
    return normA === normB || normA.includes(normB) || normB.includes(normA);
  }

  /**
   * Recursively fetches all video files inside a folder
   */
  private async getAllVideoFilesRecursively(folderId: number): Promise<any[]> {
    let allVideoFiles: any[] = [];
    try {
      const folderDetails = await this.getFolderContents(folderId);
      
      // Add video files from current folder
      if (folderDetails.files && Array.isArray(folderDetails.files)) {
        const videoFiles = folderDetails.files.filter(file => {
          const extension = (file.name || '').split('.').pop()?.toLowerCase() || '';
          const isVideoExt = ['mkv', 'mp4', 'avi', 'mov', 'webm', 'ts', 'm4v', 'flv', 'wmv'].includes(extension);
          // Include if Seedr says play_video is true, OR if it has a known video extension, OR if it's larger than 50MB (likely a video file inside an archive or missing extension)
          const isLargeFile = (file.size || 0) > 50 * 1024 * 1024;
          return file.play_video || isVideoExt || isLargeFile;
        });
        allVideoFiles = allVideoFiles.concat(videoFiles);
      }
      
      // Recursively check subfolders
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

  /**
   * Checks if a stream exists in Seedr account and gets its status/URLs
   */
  async checkStreamStatus(infoHash: string, title: string): Promise<SeedrStatusResponse> {
    try {
      const root = await this.getRootContents();
      const cleanInfoHash = infoHash.toLowerCase().trim();

      // 1. Check if it's currently downloading/queued in torrents
      if (root.torrents && Array.isArray(root.torrents)) {
        let matchingTorrent = root.torrents.find(t => {
          const tHash = (t.hash || t.info_hash || '').toLowerCase().trim();
          if (tHash && tHash === cleanInfoHash) return true;
          
          return this.strictTitlesMatch(t.name || '', title);
        });

        // Try looser match
        if (!matchingTorrent) {
          matchingTorrent = root.torrents.find(t => {
            return this.titlesMatch(t.name || '', title);
          });
        }

        if (matchingTorrent) {
          // Calculate progress percentage
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

      // 2. Check root files for a direct match
      if (root.files && Array.isArray(root.files)) {
        let matchingFile = root.files.find(f => {
          return this.strictTitlesMatch(f.name || '', title);
        });

        // Try looser match
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

      // 3. Check folders for a match, and inspect files inside matching folders
      if (root.folders && Array.isArray(root.folders)) {
        // Find matching folders
        let matchingFolders = root.folders.filter(folder => {
          return this.strictTitlesMatch(folder.name || '', title);
        });

        // Try looser match if no strict match
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

      // If we got here, it's not in the account
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
