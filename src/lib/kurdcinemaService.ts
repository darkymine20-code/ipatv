import * as cheerio from 'cheerio';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const BASE_URL = "https://kurdcinama.com";

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchWithProxy(targetUrl: string, isJson = false): Promise<any> {
  // 1. Native iOS Capacitor HTTP Request (Runs on iOS device directly without browser CORS)
  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({
        url: targetUrl,
        headers: DEFAULT_HEADERS
      });
      if (response.status >= 200 && response.status < 300) {
        let data = response.data;
        if (isJson && typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) {}
        }
        return data;
      }
    } catch (err) {
      console.warn('[CapacitorHttp] Native fetch failed:', err);
    }
  }

  // 2. Direct fetch fallback
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      return isJson ? await res.json() : await res.text();
    }
  } catch (err) {}

  // 3. AllOrigins Raw Proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const text = await proxyRes.text();
      return isJson ? JSON.parse(text) : text;
    }
  } catch (err) {}

  // 4. CorsProxy.io Proxy
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const text = await proxyRes.text();
      return isJson ? JSON.parse(text) : text;
    }
  } catch (err) {}

  // 5. CodeTabs Proxy
  try {
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const text = await proxyRes.text();
      return isJson ? JSON.parse(text) : text;
    }
  } catch (err) {}

  throw new Error(`Failed to fetch ${targetUrl}`);
}

export async function searchKurdcinema(query: string, filter: string = 'all') {
  if (!query || !query.trim()) return [];
  const searchUrl = `${BASE_URL}/Search.aspx?ajax=1&term=${encodeURIComponent(query.trim())}&filter=${encodeURIComponent(filter)}`;
  try {
    const data = await fetchWithProxy(searchUrl, true);
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
  } catch (e) {}

  if (filter !== 'all') {
    try {
      const fallbackUrl = `${BASE_URL}/Search.aspx?ajax=1&term=${encodeURIComponent(query.trim())}&filter=all`;
      const fallbackData = await fetchWithProxy(fallbackUrl, true);
      if (Array.isArray(fallbackData)) return fallbackData;
      if (typeof fallbackData === 'string') {
        try {
          const parsed = JSON.parse(fallbackData);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
      }
    } catch (err) {}
  }
  return [];
}

export async function scrapeComments(urlOrId: string, contentType: string = 'movie', includeReplies: boolean = true) {
  let targetUrl = urlOrId.trim();

  if (/^\d+$/.test(targetUrl)) {
    if (contentType === 'series') {
      targetUrl = `${BASE_URL}/Episodes.aspx?type=${targetUrl}`;
    } else {
      targetUrl = `${BASE_URL}/moves-details.aspx?movieid=${targetUrl}`;
    }
  } else if (targetUrl.includes('.aspx')) {
    if (!targetUrl.startsWith('/')) targetUrl = '/' + targetUrl;
    if (targetUrl.includes('movies-details.aspx')) {
      targetUrl = targetUrl.replace('movies-details.aspx', 'moves-details.aspx');
    }
    targetUrl = `${BASE_URL}${targetUrl}`;
  } else if (targetUrl.startsWith('/')) {
    targetUrl = `${BASE_URL}${targetUrl}`;
  } else if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    if (targetUrl.includes('movies-details.aspx')) {
      targetUrl = targetUrl.replace('movies-details.aspx', 'moves-details.aspx');
    }
  } else {
    if (contentType === 'series') {
      targetUrl = `${BASE_URL}/Episodes.aspx?type=${targetUrl}`;
    } else {
      targetUrl = `${BASE_URL}/moves-details.aspx?movieid=${targetUrl}`;
    }
  }

  let html: string = '';
  try {
    html = await fetchWithProxy(targetUrl, false);
  } catch (e) {
    return null;
  }

  if (!html || typeof html !== 'string') {
    return null;
  }

  const $ = cheerio.load(html);

  const title = $('title').text().replace('| کوردسینەما', '').replace('| فیلمی ژێرنوسکراوی کوردی', '').trim() || 'Kurdcinema Title';
  const avgRating = $('.reviews-avg span, .rating-num, .movie-rating span').text().trim() || 'N/A';
  const totalReviewsLabel = $('.reviews-count, .comments-count').text().trim() || '0 comments';

  const comments: any[] = [];
  const reviewCards = $('.reviews-list .review-card, .review-card, .comment-card, .comment-item, .card').toArray();

  for (let i = 0; i < reviewCards.length; i++) {
    const card = $(reviewCards[i]);
    let reviewId = card.attr('data-reviewid') || card.attr('data-commentid');
    const replyBtn = card.find('.btn-reply');
    if (replyBtn.length > 0 && !reviewId) {
      reviewId = replyBtn.attr('data-reviewid');
    }
    if (!reviewId) {
      reviewId = `temp_${i + 1}`;
    }

    const userNameLink = card.find('.review-user-name-link, .user-name, .comment-author, a');
    const userName = userNameLink.text().trim() || 'Kurdcinema User';
    const userProfileHref = userNameLink.attr('href');
    const userProfile = userProfileHref ? `${BASE_URL}/${userProfileHref}` : '';

    const userPhotoImg = card.find('.review-user-photo, .user-avatar, img');
    const userPhotoSrc = userPhotoImg.attr('src');
    const userPhoto = userPhotoSrc ? (userPhotoSrc.startsWith('http') ? userPhotoSrc : `${BASE_URL}${userPhotoSrc}`) : '';

    const userBadge = card.find('.review-user-badge, .badge').text().trim();
    const date = card.find('.review-date, .date, .comment-date').text().trim();
    const rating = card.find('.review-rating span, .user-rating').text().trim();
    const textP = card.find('.review-text, .comment-text, p');
    const reviewText = textP.text().trim();

    if (!reviewText) continue;

    const isSpoiler = card.hasClass('has-spoiler') || textP.hasClass('spoiler-hidden');
    const likes = card.find('.btn-like .count, .likes-count').text().trim() || '0';
    const dislikes = card.find('.btn-dislike .count, .dislikes-count').text().trim() || '0';
    
    let repliesCount = 0;
    const repliesSpanText = card.find('.btn-reply .count').text().trim();
    if (repliesSpanText.includes('(') && repliesSpanText.includes(')')) {
      try {
        const countStr = repliesSpanText.split('(')[1].split(')')[0];
        repliesCount = parseInt(countStr, 10);
      } catch (e) {}
    }

    comments.push({
      review_id: reviewId,
      user_name: userName,
      user_profile: userProfile,
      user_photo: userPhoto,
      user_badge: userBadge,
      date,
      rating,
      text: reviewText,
      is_spoiler: isSpoiler,
      likes_count: likes,
      dislikes_count: dislikes,
      replies_count: repliesCount,
      replies: []
    });
  }

  return {
    title,
    average_rating: avgRating,
    total_reviews_label: totalReviewsLabel,
    scraped_url: targetUrl,
    comments
  };
}
