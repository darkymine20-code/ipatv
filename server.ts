import { searchKurdcinema, scrapeComments } from './src/lib/kurdcinemaService.js';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import http from "http";
import https from "https";
import net from "net";
import tls from "tls";
import { GoogleGenAI, Type } from "@google/genai";
import { SeedrClient } from "./src/lib/seedrService.js";
import { loadDb, saveDb } from "./src/db/jsonDb.js";
import { getDb, initDb, getUsePostgres, getDbError } from "./src/db/index.js";
import { userProfiles, mediaItems, watchedEpisodes } from "./src/db/schema.js";
import { eq, and } from "drizzle-orm";
import compression from "compression";

const localDb = loadDb();

// Mutex queues to serialize state save transactions per user/device and prevent concurrent database overlap
const userMutexes = new Map<string, Promise<any>>();



let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  app.use(compression());
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const seedrClient = new SeedrClient();

  // API: Health check for platform

  // API: Kurdcinema Search
  app.get("/api/kurdcinema/search", async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { q, type } = req.query;
      if (!q) {
        res.status(400).json({ error: "Missing query parameter" });
        return;
      }
      const results = await searchKurdcinema(q as string, (type as string) || 'all');
      res.json(results);
    } catch (error: any) {
      console.error('Kurdcinema search error:', error);
      res.status(500).json({ error: error.message || "Failed to search Kurdcinema" });
    }
  });

  // API: Kurdcinema Comments
  app.get("/api/kurdcinema/comments", async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { url, type } = req.query;
      if (!url) {
        res.status(400).json({ error: "Missing url parameter" });
        return;
      }
      const data = await scrapeComments(url as string, (type as string) || 'movie', true);
      res.json(data);
    } catch (error: any) {
      console.error('Kurdcinema comments error:', error);
      res.status(500).json({ error: error.message || "Failed to fetch Kurdcinema comments" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      database: {
        usePostgres: getUsePostgres(),
        hasDbUrl: !!process.env.DATABASE_URL,
        dbError: getDbError()
      }
    });
  });

  // API: Get Seedr stream status (ready, downloading, not_added)
  app.get("/api/seedr/status", async (req, res): Promise<void> => {
    const { infoHash, title } = req.query;
    if (!infoHash || typeof infoHash !== "string" || !title || typeof title !== "string") {
      res.status(400).json({ error: "Missing infoHash or title parameters" });
      return;
    }

    try {
      const status = await seedrClient.checkStreamStatus(infoHash, title);
      res.json(status);
    } catch (error: any) {
      console.error("Error checking Seedr status:", error);
      res.status(500).json({ error: error.message || "Failed to check Seedr status" });
    }
  });

  // API: Add magnet to Seedr (with precheck and cleanup if not exists)
  app.post("/api/seedr/add", async (req, res): Promise<void> => {
    const { magnet, infoHash, title } = req.body;
    if (!magnet || !infoHash || !title) {
      res.status(400).json({ error: "Missing magnet, infoHash, or title parameters" });
      return;
    }

    try {
      // 1. Check if the exact same stream already exists on Seedr
      const currentStatus = await seedrClient.checkStreamStatus(infoHash, title);
      if (currentStatus.status === 'ready' || currentStatus.status === 'downloading') {
        console.log(`Stream ${title} already exists on Seedr with status: ${currentStatus.status}. Skipping addition.`);
        res.json(currentStatus);
        return;
      }

      // 2. If not added, clear existing storage first to free up space (since it's a new request)
      console.log(`Stream ${title} is not on Seedr. Clearing storage and adding torrent...`);
      await seedrClient.clearAllContents();

      // 3. Add the new magnet link
      await seedrClient.addMagnet(magnet);

      // 4. Return new status (should be downloading now)
      const newStatus = await seedrClient.checkStreamStatus(infoHash, title);
      res.json(newStatus);
    } catch (error: any) {
      console.error("Error adding stream to Seedr:", error);
      res.status(500).json({ error: error.message || "Failed to add stream to Seedr" });
    }
  });

  // API: Manually clear Seedr contents
  app.post("/api/seedr/clear", async (req, res): Promise<void> => {
    try {
      await seedrClient.clearAllContents();
      res.json({ success: true, message: "Seedr storage cleared successfully" });
    } catch (error: any) {
      console.error("Error clearing Seedr storage:", error);
      res.status(500).json({ error: error.message || "Failed to clear Seedr storage" });
    }
  });

  // API: Get IMDb reviews via GraphQL
  // API: Get IMDb Rating
  app.get("/api/imdb-rating", async (req, res): Promise<void> => {
    const { imdbId } = req.query;
    if (!imdbId || typeof imdbId !== "string") {
      res.status(400).json({ error: "Missing imdbId parameter" });
      return;
    }
    
    try {
      const BASE_URL = "https://caching.graphql.imdb.com/";
      const headers = {
        'accept': 'application/graphql+json, application/json',
        'content-type': 'application/json',
        'origin': 'https://www.imdb.com'
      };
      
      const payload = {
        query: `query GetTitleRating($id: ID!) {
          title(id: $id) {
            titleText {
              text
            }
            releaseYear {
              year
            }
            ratingsSummary {
              aggregateRating
              voteCount
            }
          }
        }`,
        operationName: "GetTitleRating",
        variables: {
          id: imdbId
        }
      };
      
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`IMDb API returned status ${response.status}`);
      }
      
      const data = await response.json();
      const titleData = data?.data?.title;
      
      if (!titleData) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      
      const rating = titleData.ratingsSummary?.aggregateRating || null;
      const votes = titleData.ratingsSummary?.voteCount || 0;
      
      res.json({ rating, votes });
    } catch (error) {
      console.error('Error fetching IMDb rating:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/imdb-reviews", async (req, res): Promise<void> => {
    const { imdbId } = req.query;
    if (!imdbId || typeof imdbId !== "string") {
      res.status(400).json({ error: "Missing imdbId parameter" });
      return;
    }
    
    try {
      const BASE_URL = "https://caching.graphql.imdb.com/";
      const PAGE_SIZE = 25;
      
      const headers = {
        'accept': 'application/graphql+json, application/json',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': 'https://www.imdb.com',
        'priority': 'u=1, i'
      };

      const getPayload = (afterCursor: string | null) => ({
        query: `query TitleReviewsRefine($const: ID!, $filter: ReviewsFilter, $first: Int!, $sort: ReviewsSort, $after: ID) {
          title(id: $const) {
            reviews(filter: $filter, first: $first, sort: $sort, after: $after) {
              edges {
                node {
                  id
                  author {
                    nickName
                  }
                  authorRating
                  helpfulness {
                    upVotes
                    downVotes
                  }
                  submissionDate
                  text {
                    originalText {
                      plainText
                    }
                  }
                  summary {
                    originalText
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }`,
        operationName: "TitleReviewsRefine",
        variables: {
          const: imdbId,
          filter: {},
          first: PAGE_SIZE,
          sort: {
            by: "HELPFULNESS_SCORE",
            order: "DESC"
          },
          ...(afterCursor ? { after: afterCursor } : {})
        }
      });

      // Fetch first page
      const res1 = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(getPayload(null))
      });
      
      if (!res1.ok) {
        throw new Error(`IMDb API returned status ${res1.status}`);
      }
      
      const data1 = await res1.json();
      if (data1.errors) {
        throw new Error(data1.errors[0]?.message || "GraphQL error");
      }
      
      let allEdges = data1.data?.title?.reviews?.edges || [];
      const pageInfo = data1.data?.title?.reviews?.pageInfo;
      
      // Fetch second page if needed (to get up to 50)
      if (pageInfo?.hasNextPage && pageInfo?.endCursor && allEdges.length < 50) {
        const res2 = await fetch(BASE_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(getPayload(pageInfo.endCursor))
        });
        if (res2.ok) {
          const data2 = await res2.json();
          if (!data2.errors) {
            const moreEdges = data2.data?.title?.reviews?.edges || [];
            allEdges = [...allEdges, ...moreEdges];
          }
        }
      }

      // Format the results to match the TMDBReview interface somewhat, or just return as is and format in client
      const formattedReviews = allEdges.slice(0, 50).map((edge: any) => {
        const node = edge.node;
        return {
          id: node.id,
          author: node.author?.nickName || "IMDb User",
          rating: node.authorRating,
          content: node.text?.originalText?.plainText || "",
          summary: node.summary?.originalText || "",
          createdAt: node.submissionDate,
          likes: node.helpfulness?.upVotes || 0,
          downVotes: node.helpfulness?.downVotes || 0,
          source: 'imdb'
        };
      });

      res.json({ reviews: formattedReviews });
    } catch (error: any) {
      console.error("IMDb Reviews API error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch IMDb reviews" });
    }
  });



  // API: Video proxy to avoid mixed content (HTTP inside HTTPS) and enable in-app player
  app.get("/api/proxy-video", (req, res): void => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      res.status(400).send("Missing url parameter");
      return;
    }

    const proxyVideoRequest = (targetUrl: string, method: string, incomingHeaders: any, redirectCount = 0) => {
      if (redirectCount > 5) {
        res.status(502).send("Too many redirects");
        return;
      }

      try {
        const parsedUrl = new URL(targetUrl);
        const isHttps = parsedUrl.protocol === "https:";
        const client = isHttps ? https : http;

        const headers: Record<string, string> = {};
        if (incomingHeaders.range) {
          headers['range'] = incomingHeaders.range;
        }
        if (incomingHeaders['user-agent']) {
          headers['user-agent'] = incomingHeaders['user-agent'];
        }
        // Set host header to satisfy remote virtual hosting & CDN security rules
        headers['host'] = parsedUrl.host;

        const proxyReq = client.request(targetUrl, {
          method: method,
          headers,
        }, (proxyRes) => {
          const statusCode = proxyRes.statusCode || 200;

          // Handle Redirects
          if ([301, 302, 303, 307, 308].includes(statusCode)) {
            const location = proxyRes.headers.location;
            if (location) {
              const absoluteLocation = new URL(location, targetUrl).toString();
              proxyVideoRequest(absoluteLocation, method, incomingHeaders, redirectCount + 1);
              return;
            }
          }

          // Copy status and headers from target server
          res.status(statusCode);
          
          Object.entries(proxyRes.headers).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase();
            if (['content-type', 'content-range', 'content-length', 'accept-ranges', 'content-disposition', 'etag', 'last-modified'].includes(lowerKey)) {
              if (value !== undefined) {
                res.setHeader(key, Array.isArray(value) ? value.join(', ') : String(value));
              }
            }
          });

          // Enable CORS
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');

          if (method === "HEAD") {
            res.end();
          } else {
            proxyRes.pipe(res);
          }
        });

        proxyReq.on('error', (err) => {
          console.error(`Upstream proxy request error for ${targetUrl}:`, err);
          if (!res.headersSent) {
            res.status(500).send("Error streaming video");
          }
        });

        // Handle client disconnect
        req.on('close', () => {
          proxyReq.destroy();
        });

        proxyReq.end();

      } catch (error) {
        console.error("Video proxy inner error:", error);
        if (!res.headersSent) {
          res.status(500).send("Error streaming video");
        }
      }
    };

    proxyVideoRequest(url, req.method, req.headers);
  });

  // Helper to decode chunked HTTP body safely from custom socket buffer
  const decodeChunked = (bodyBuffer: Buffer): Buffer => {
    const chunks: Buffer[] = [];
    let index = 0;
    while (index < bodyBuffer.length) {
      let crlf = bodyBuffer.indexOf("\r\n", index);
      if (crlf === -1) {
        crlf = bodyBuffer.indexOf("\n", index);
      }
      if (crlf === -1) break;

      const sizeStr = bodyBuffer.slice(index, crlf).toString("utf-8").trim();
      if (!sizeStr) {
        index = crlf + (bodyBuffer[crlf] === 13 ? 2 : 1);
        continue;
      }

      const size = parseInt(sizeStr, 16);
      if (isNaN(size)) {
        // Not chunked or parse error, append remaining buffer as is
        chunks.push(bodyBuffer.slice(index));
        break;
      }

      if (size === 0) break;

      const startOfData = crlf + (bodyBuffer[crlf] === 13 ? 2 : 1);
      const endOfData = startOfData + size;
      chunks.push(bodyBuffer.slice(startOfData, Math.min(endOfData, bodyBuffer.length)));

      index = endOfData + 2; // skip data plus trailing \r\n
    }
    return Buffer.concat(chunks);
  };

  // Custom raw socket HTTP/HTTPS fetcher to completely bypass Node.js strict http parser
  const socketFetch = (urlStr: string, method: string = "GET", maxRedirects = 5): Promise<{ status: number; body: string }> => {
    return new Promise((resolve, reject) => {
      if (maxRedirects < 0) {
        reject(new Error("Too many redirects"));
        return;
      }

      try {
        const parsedUrl = new URL(urlStr);
        const isHttps = parsedUrl.protocol === "https:";
        const port = parsedUrl.port ? parseInt(parsedUrl.port) : (isHttps ? 443 : 80);
        const hostname = parsedUrl.hostname;
        const pathWithQuery = parsedUrl.pathname + parsedUrl.search;

        const options = {
          host: hostname,
          port: port,
          rejectUnauthorized: false
        };

        const socket = isHttps 
          ? tls.connect(options)
          : net.connect(options);

        // Set socket timeouts to avoid hanging connections
        socket.setTimeout(10000);

        let buffer = Buffer.alloc(0);
        let headersParsed = false;
        let statusCode = 200;
        let isChunked = false;
        let headerLength = 0;

        socket.on("timeout", () => {
          socket.destroy(new Error("Socket timeout"));
        });

        socket.on("connect", () => {
          const reqStr = 
            `${method} ${pathWithQuery} HTTP/1.1\r\n` +
            `Host: ${hostname}\r\n` +
            `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n` +
            `Accept: */*\r\n` +
            `Connection: close\r\n\r\n`;
          socket.write(reqStr);
        });

        socket.on("data", (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);

          if (!headersParsed) {
            const headerEndIndex = buffer.indexOf("\r\n\r\n");
            if (headerEndIndex !== -1) {
              headersParsed = true;
              headerLength = headerEndIndex + 4;
              const headerStr = buffer.slice(0, headerEndIndex).toString("utf-8");
              const lines = headerStr.split("\r\n");
              
              const statusLine = lines[0];
              const match = statusLine.match(/HTTP\/1\.[01]\s+(\d+)/i);
              if (match) {
                statusCode = parseInt(match[1]);
              }

              isChunked = lines.some(line => {
                const parts = line.split(":");
                return parts[0] && parts[1] && 
                  parts[0].trim().toLowerCase() === "transfer-encoding" && 
                  parts[1].trim().toLowerCase() === "chunked";
              });

              if ([301, 302, 303, 307, 308].includes(statusCode)) {
                let location: string | undefined;
                for (const line of lines) {
                  const parts = line.split(":");
                  if (parts[0] && parts[0].trim().toLowerCase() === "location") {
                    location = line.substring(line.indexOf(":") + 1).trim();
                    break;
                  }
                }
                if (location) {
                  socket.destroy();
                  const redirectUrl = new URL(location, urlStr).toString();
                  socketFetch(redirectUrl, method, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject);
                  return;
                }
              }
            }
          }
        });

        socket.on("end", () => {
          if (!headersParsed) {
            resolve({ status: 502, body: "Invalid response" });
            return;
          }

          const rawBody = buffer.slice(headerLength);
          let finalBody = "";

          if (isChunked) {
            try {
              const decoded = decodeChunked(rawBody);
              finalBody = decoded.toString("utf-8");
            } catch (e) {
              finalBody = rawBody.toString("utf-8");
            }
          } else {
            finalBody = rawBody.toString("utf-8");
          }

          resolve({ status: statusCode, body: finalBody });
        });

        socket.on("error", (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  // Helper to fetch remote files using Node.js standard http/https modules
  // This avoids undici / fetch strictness like Content-Length mismatch errors
  // If the server returns invalid spec-violating headers, we fall back to our custom socket fetcher
  const fetchWithNode = (urlStr: string, method: string = "GET", maxRedirects = 5): Promise<{ status: number; body: string }> => {
    return new Promise((resolve, reject) => {
      if (maxRedirects < 0) {
        reject(new Error("Too many redirects"));
        return;
      }

      const runStandardFetch = () => {
        try {
          const parsedUrl = new URL(urlStr);
          const isHttps = parsedUrl.protocol === "https:";
          const client = isHttps ? https : http;

          const options = {
            method,
            insecureHTTPParser: true, // Allow spec-violating headers in first pass
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "*/*"
            }
          };

          const req = client.request(parsedUrl, options, (res) => {
            const { statusCode } = res;

            // Handle redirects
            if (statusCode && [301, 302, 303, 307, 308].includes(statusCode)) {
              const location = res.headers.location;
              if (location) {
                const redirectUrl = new URL(location, urlStr).toString();
                fetchWithNode(redirectUrl, method, maxRedirects - 1)
                  .then(resolve)
                  .catch(reject);
                return;
              }
            }

            if (statusCode && statusCode >= 400) {
              resolve({ status: statusCode, body: `HTTP Error ${statusCode}` });
              return;
            }

            if (method === "HEAD") {
              resolve({ status: statusCode || 200, body: "" });
              return;
            }

            const chunks: Buffer[] = [];
            res.on("data", (chunk) => {
              chunks.push(chunk);
            });

            res.on("end", () => {
              const buffer = Buffer.concat(chunks);
              const text = buffer.toString("utf-8");
              resolve({ status: statusCode || 200, body: text });
            });
          });

          req.on("error", (err) => {
            console.warn(`Standard http/https request failed for ${urlStr}. Error: ${err.message}. Retrying with raw socket client...`);
            // Fall back to socketFetch!
            socketFetch(urlStr, method, maxRedirects)
              .then(resolve)
              .catch(reject);
          });

          req.end();
        } catch (err: any) {
          console.warn(`Standard http/https setup failed for ${urlStr}. Error: ${err.message}. Retrying with raw socket client...`);
          // Fall back to socketFetch!
          socketFetch(urlStr, method, maxRedirects)
            .then(resolve)
            .catch(reject);
        }
      };

      runStandardFetch();
    });
  };

  // API: Subtitle proxy to download and convert .srt to WebVTT or serve raw .srt
  const handleSubtitleProxy = async (req: express.Request, res: express.Response, format: "vtt" | "srt"): Promise<void> => {
    let url = req.query.url as string | undefined;

    if (req.params.encodedUrl) {
      try {
        let base64 = req.params.encodedUrl.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
          base64 += '=';
        }
        url = Buffer.from(base64, "base64").toString("utf-8");
      } catch (err) {
        console.error(`Failed to decode subtitle URL parameter ${req.params.encodedUrl}:`, err);
      }
    }

    if (!url || typeof url !== "string") {
      res.status(400).send("Missing url parameter");
      return;
    }

    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");

      if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
      }

      // Handle HEAD request efficiently using Node-native client
      if (req.method === "HEAD") {
        try {
          const { status } = await fetchWithNode(url, "HEAD");
          res.status(status);
          res.end();
        } catch (err) {
          console.error(`HEAD check error for ${url}:`, err);
          res.status(404).end();
        }
        return;
      }

      // Fetch the actual subtitle content using our custom Node client (safe from Content-Length mismatches)
      const { status, body } = await fetchWithNode(url, "GET");
      if (status >= 400) {
        res.status(status || 404).send("Subtitle not found");
        return;
      }

      if (format === "vtt") {
        // Convert SRT to WebVTT
        const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const vttContent = "WEBVTT\n\n" + normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        res.setHeader("Content-Type", "text/vtt; charset=utf-8");
        res.status(200).send(vttContent);
      } else {
        // Return raw SRT
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.status(200).send(body);
      }
    } catch (error: any) {
      console.error(`Error proxying subtitle for ${url}:`, error);
      res.status(500).send("Error fetching subtitle");
    }
  };

  app.get("/api/proxy-subtitle", (req, res) => handleSubtitleProxy(req, res, "vtt"));
  app.get("/api/proxy-subtitle.vtt", (req, res) => handleSubtitleProxy(req, res, "vtt"));
  app.get("/api/proxy-subtitle.srt", (req, res) => handleSubtitleProxy(req, res, "srt"));
  app.get("/api/proxy-subtitle/:encodedUrl/sub.srt", (req, res) => handleSubtitleProxy(req, res, "srt"));
  app.get("/api/proxy-subtitle/:encodedUrl/sub.vtt", (req, res) => handleSubtitleProxy(req, res, "vtt"));

  // Serve Flussonic M3U Playlist dynamically
  const handleFlussonicM3u = (req: express.Request, res: express.Response) => {
    const { url, title } = req.query;
    if (!url || typeof url !== "string") {
      res.status(400).send("Missing url parameter");
      return;
    }
    const cleanTitle = (typeof title === "string" ? title : "Stream").trim();
    
    const m3uContent = [
      '#EXTM3U',
      `#EXTINF:-1,${cleanTitle}`,
      '#EXTVLCOPT:http-user-agent=IOS$MyTV',
      '#EXTVLCOPT:http-header-fields=X-Playback-Session-Id: E12A8A10-EFEF-44AF-85EC-4455721EE7EF, Accept-Language: en-GB;q=0.9',
      url
    ].join('\n');

    res.setHeader("Content-Type", "application/x-mpegurl");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(cleanTitle)}.m3u"`);
    res.status(200).send(m3uContent);
  };

  app.get("/api/flussonic.m3u", handleFlussonicM3u);
  app.get("/api/flussonic/playlist.m3u", handleFlussonicM3u);

  // Middleware to extract deviceId from headers
  const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing device token' });
    }
    const deviceId = authHeader.split('Bearer ')[1];
    (req as any).deviceId = deviceId;
    
    // Ensure profile exists
    try {
      if (getUsePostgres()) {
        const db = getDb();
        await db.insert(userProfiles)
          .values({ id: deviceId })
          .onConflictDoNothing();
      } else {
        if (!localDb.profiles.includes(deviceId)) {
          localDb.profiles.push(deviceId);
          saveDb(localDb);
        }
      }
    } catch (e) {
      console.error('[authMiddleware] Profile check error:', e);
    }
    next();
  };

  // API: Get complete state
  app.get("/api/state", authMiddleware, async (req: express.Request, res: express.Response): Promise<any> => {
    const deviceId = (req as any).deviceId;
    
    try {
      let items: any[] = [];
      let eps: any[] = [];
      
      if (getUsePostgres()) {
        const db = getDb();
        items = await db.select().from(mediaItems).where(eq(mediaItems.userId, deviceId));
        eps = await db.select().from(watchedEpisodes).where(eq(watchedEpisodes.userId, deviceId));
      } else {
        items = localDb.mediaItems.filter(i => i.userId === deviceId);
        eps = localDb.watchedEpisodes.filter(e => e.userId === deviceId);
      }
      
      const shows = items.filter(i => i.type === 'show').map(i => ({ ...i, id: i.mediaId, rating: parseFloat(i.rating || '0') }));
      const movies = items.filter(i => i.type === 'movie').map(i => ({ ...i, id: i.mediaId, rating: parseFloat(i.rating || '0') }));
      
      const watchedEpsDict: Record<number, Record<string, boolean>> = {};
      eps.forEach(ep => {
        if (!watchedEpsDict[ep.showId]) watchedEpsDict[ep.showId] = {};
        watchedEpsDict[ep.showId][ep.episodeKey] = true;
      });
      
      const favorites = items.filter(i => i.isFavorite).map(i => i.mediaId);

      res.json({
        shows,
        movies,
        watchedEpisodes: watchedEpsDict,
        favorites,
        dbStatus: {
          usePostgres: getUsePostgres(),
          hasDbUrl: !!process.env.DATABASE_URL,
          dbError: getDbError()
        }
      });
    } catch (error) {
      console.error('Error fetching state:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  
  // API: Update complete state
  app.post("/api/state", authMiddleware, async (req, res) => {
    const deviceId = (req as any).deviceId;

    // Retrieve or initialize the queue for this user/device
    const currentPromise = userMutexes.get(deviceId) || Promise.resolve();

    // Schedule this write task in the user's serialization queue
    const nextPromise = currentPromise.then(async () => {
      const { shows, movies, watchedEpisodes: watchedEpsData, favorites } = req.body;
      
      const uniqueShows = shows && Array.isArray(shows) ? Array.from(new Map(shows.map((s: any) => [s.id, s])).values()) : [];
      const uniqueMovies = movies && Array.isArray(movies) ? Array.from(new Map(movies.map((m: any) => [m.id, m])).values()) : [];
      
      // Update watched episodes
      const epsToInsert: any[] = [];
      if (watchedEpsData && typeof watchedEpsData === 'object') {
         Object.keys(watchedEpsData).forEach(showIdStr => {
           const showId = Number(showIdStr);
           if (isNaN(showId) || showId <= 0) return;
           const eps = watchedEpsData[showId];
           if (eps && typeof eps === 'object') {
             Object.keys(eps).forEach(epKey => {
               if (eps[epKey]) {
                 epsToInsert.push({
                   userId: deviceId,
                   showId,
                   episodeKey: epKey,
                   watchedAt: new Date()
                 });
               }
             });
           }
         });
      }

      // Backend Safety Guard: Prevent accidental empty state wipe/overwrite of existing data
      let hasExistingData = false;
      if (getUsePostgres()) {
        const db = getDb();
        const existingCount = await db.select().from(mediaItems).where(eq(mediaItems.userId, deviceId));
        if (existingCount.length > 0) {
          hasExistingData = true;
        }
      } else {
        hasExistingData = localDb.mediaItems.some(i => i.userId === deviceId);
      }

      const isReset = req.headers['x-force-reset'] === 'true';
      const incomingEmpty = uniqueShows.length === 0 && uniqueMovies.length === 0 && epsToInsert.length === 0;

      if (hasExistingData && incomingEmpty && !isReset) {
        console.warn(`[API Guard] Blocked incoming empty state save for user ${deviceId} to prevent accidental wipe!`);
        return; // Return silently, no database changes
      }

      const allItems: any[] = [];
      if (uniqueShows.length > 0) {
        uniqueShows.forEach((show: any) => {
          allItems.push({
            userId: deviceId,
            mediaId: show.id,
            type: 'show',
            title: show.title || 'Untitled',
            posterPath: show.posterPath || null,
            backdropPath: show.backdropPath || null,
            overview: show.overview || null,
            releaseDate: show.releaseDate || null,
            genres: show.genres || null,
            rating: show.rating?.toString() || null,
            runtime: show.runtime !== undefined ? show.runtime : null,
            seasonsCount: show.seasonsCount !== undefined ? show.seasonsCount : null,
            episodesCount: show.episodesCount !== undefined ? show.episodesCount : null,
            inWatchlist: show.inWatchlist || false,
            isFavorite: show.isFavorite || false,
            userRating: show.userRating !== undefined ? show.userRating : null,
            completed: show.completed || false,
            stoppedWatching: show.stoppedWatching || false,
            lastWatchedAt: show.lastWatchedAt ? new Date(show.lastWatchedAt) : null,
            seasons: show.seasons || null,
            imdbId: show.imdbId || null,
            cast: show.cast || null,
            directors: show.directors || null
          });
        });
      }
      
      if (uniqueMovies.length > 0) {
        uniqueMovies.forEach((movie: any) => {
          allItems.push({
            userId: deviceId,
            mediaId: movie.id,
            type: 'movie',
            title: movie.title || 'Untitled',
            posterPath: movie.posterPath || null,
            backdropPath: movie.backdropPath || null,
            overview: movie.overview || null,
            releaseDate: movie.releaseDate || null,
            genres: movie.genres || null,
            rating: movie.rating?.toString() || null,
            runtime: movie.runtime !== undefined ? movie.runtime : null,
            inWatchlist: movie.inWatchlist || false,
            isFavorite: movie.isFavorite || false,
            userRating: movie.userRating !== undefined ? movie.userRating : null,
            completed: movie.completed || false,
            lastWatchedAt: movie.lastWatchedAt ? new Date(movie.lastWatchedAt) : null,
            imdbId: movie.imdbId || null,
            cast: movie.cast || null,
            directors: movie.directors || null
          });
        });
      }
      
      // Update favorites
      if (favorites && Array.isArray(favorites)) {
         allItems.forEach(item => {
           if (favorites.includes(item.mediaId)) {
             item.isFavorite = true;
           } else {
             item.isFavorite = false;
           }
         });
      }

      if (getUsePostgres()) {
        const db = getDb();
        await db.transaction(async (tx: any) => {
          await tx.delete(mediaItems).where(eq(mediaItems.userId, deviceId));
          await tx.delete(watchedEpisodes).where(eq(watchedEpisodes.userId, deviceId));
          
          if (allItems.length > 0) {
            await tx.insert(mediaItems).values(allItems);
          }
          
          if (epsToInsert.length > 0) {
            await tx.insert(watchedEpisodes).values(epsToInsert);
          }
        });
      } else {
        // Clear existing
        localDb.mediaItems = localDb.mediaItems.filter(i => i.userId !== deviceId);
        localDb.watchedEpisodes = localDb.watchedEpisodes.filter(e => e.userId !== deviceId);
        
        if (allItems.length > 0) {
          localDb.mediaItems.push(...allItems);
        }
        
        if (epsToInsert.length > 0) {
          localDb.watchedEpisodes.push(...epsToInsert);
        }
        
        saveDb(localDb);
      }
    });

    userMutexes.set(deviceId, nextPromise);

    try {
      await nextPromise;
      res.json({ success: true });
    } catch (error) {
      console.error('Error in serialized save task:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API: Upsert Media Item (with all fields)
  app.post("/api/media", authMiddleware, async (req: express.Request, res: express.Response): Promise<any> => {
    const deviceId = (req as any).deviceId;
    const { media } = req.body; // should pass { media: MediaItem }
    
    try {
      const itemData = {
        userId: deviceId,
        mediaId: media.id,
        type: media.type,
        title: media.title,
        posterPath: media.posterPath,
        backdropPath: media.backdropPath,
        overview: media.overview,
        releaseDate: media.releaseDate,
        genres: media.genres,
        rating: media.rating?.toString(),
        runtime: media.runtime,
        seasonsCount: media.seasonsCount,
        episodesCount: media.episodesCount,
        inWatchlist: media.inWatchlist,
        isFavorite: media.isFavorite,
        userRating: media.userRating,
        completed: media.completed,
        stoppedWatching: media.stoppedWatching,
        lastWatchedAt: media.lastWatchedAt ? new Date(media.lastWatchedAt) : null,
        seasons: media.seasons,
        imdbId: media.imdbId,
        cast: media.cast || null,
        directors: media.directors || null
      };

      if (getUsePostgres()) {
        const db = getDb();
        const existing = await db.select().from(mediaItems)
          .where(and(eq(mediaItems.userId, deviceId), eq(mediaItems.mediaId, media.id)));
          
        if (existing.length > 0) {
          await db.update(mediaItems)
            .set(itemData)
            .where(eq(mediaItems.id, existing[0].id));
        } else {
          await db.insert(mediaItems).values(itemData);
        }
      } else {
        const idx = localDb.mediaItems.findIndex(i => i.userId === deviceId && i.mediaId === media.id);
        if (idx !== -1) {
          localDb.mediaItems[idx] = itemData;
        } else {
          localDb.mediaItems.push(itemData);
        }
        saveDb(localDb);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving media:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API: Toggle episode watched
  app.post("/api/episode", authMiddleware, async (req: express.Request, res: express.Response): Promise<any> => {
    const deviceId = (req as any).deviceId;
    const { showId, episodeKey, watched } = req.body;
    
    try {
      if (getUsePostgres()) {
        const db = getDb();
        await db.delete(watchedEpisodes)
          .where(and(
            eq(watchedEpisodes.userId, deviceId), 
            eq(watchedEpisodes.showId, showId), 
            eq(watchedEpisodes.episodeKey, episodeKey)
          ));
          
        if (watched) {
          await db.insert(watchedEpisodes).values({
            userId: deviceId,
            showId: showId,
            episodeKey: episodeKey,
            watchedAt: new Date()
          });
        }
      } else {
        // Remove first to prevent duplicate
        localDb.watchedEpisodes = localDb.watchedEpisodes.filter(e => !(e.userId === deviceId && e.showId === showId && e.episodeKey === episodeKey));
        
        if (watched) {
          localDb.watchedEpisodes.push({
            userId: deviceId,
            showId: showId,
            episodeKey: episodeKey,
            watchedAt: new Date()
          });
        }
        saveDb(localDb);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error toggling episode:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API: Reset all
  app.post("/api/reset", authMiddleware, async (req: express.Request, res: express.Response): Promise<any> => {
    const deviceId = (req as any).deviceId;
    try {
      if (getUsePostgres()) {
        const db = getDb();
        await db.delete(mediaItems).where(eq(mediaItems.userId, deviceId));
        await db.delete(watchedEpisodes).where(eq(watchedEpisodes.userId, deviceId));
      } else {
        localDb.mediaItems = localDb.mediaItems.filter(i => i.userId !== deviceId);
        localDb.watchedEpisodes = localDb.watchedEpisodes.filter(e => e.userId !== deviceId);
        saveDb(localDb);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });


  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Initialize the database connection (Supabase or fallback JSON) asynchronously 
    // so it never blocks port binding or Cloud Run health checks
    initDb().catch(err => {
      console.error('[Database] Asynchronous database initialization error:', err);
    });
  });
}

startServer();
