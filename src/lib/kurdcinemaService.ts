import * as cheerio from 'cheerio';

const BASE_URL = "https://kurdcinama.com";

async function fetchWithProxy(targetUrl: string, isJson = false): Promise<any> {
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      return isJson ? await res.json() : await res.text();
    }
  } catch (err) {}

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      return isJson ? await proxyRes.json() : await proxyRes.text();
    }
  } catch (err) {}

  try {
    const fallbackProxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const fallbackRes = await fetch(fallbackProxyUrl);
    if (fallbackRes.ok) {
      return isJson ? await fallbackRes.json() : await fallbackRes.text();
    }
  } catch (err) {}

  throw new Error(`Failed to fetch ${targetUrl}`);
}

export async function searchKurdcinema(query: string, filter: string = 'all') {
  const searchUrl = `${BASE_URL}/Search.aspx?ajax=1&term=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}`;
  const data = await fetchWithProxy(searchUrl, true);
  return data;
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

  const html = await fetchWithProxy(targetUrl, false);
  const $ = cheerio.load(html);

  const title = $('title').text().replace('| کوردسینەما', '').replace('| فیلمی ژێرنوسکراوی کوردی', '').trim() || 'Unknown Title';
  const avgRating = $('.reviews-avg span').text().trim() || 'N/A';
  const totalReviewsLabel = $('.reviews-count').text().trim() || '0 reviews';

  const comments: any[] = [];
  const reviewCards = $('.reviews-list .review-card').toArray();

  for (let i = 0; i < reviewCards.length; i++) {
    const card = $(reviewCards[i]);
    let reviewId = card.attr('data-reviewid');
    const replyBtn = card.find('.btn-reply');
    if (replyBtn.length > 0 && !reviewId) {
      reviewId = replyBtn.attr('data-reviewid');
    }
    if (!reviewId) {
      reviewId = `temp_${i + 1}`;
    }

    const userNameLink = card.find('.review-user-name-link');
    const userName = userNameLink.text().trim() || 'Unknown';
    const userProfileHref = userNameLink.attr('href');
    const userProfile = userProfileHref ? `${BASE_URL}/${userProfileHref}` : '';

    const userPhotoImg = card.find('.review-user-photo');
    const userPhotoSrc = userPhotoImg.attr('src');
    const userPhoto = userPhotoSrc ? `${BASE_URL}${userPhotoSrc}` : '';

    const userBadge = card.find('.review-user-badge').text().trim();
    const date = card.find('.review-date').text().trim();
    const rating = card.find('.review-rating span').text().trim();
    const textP = card.find('.review-text');
    const reviewText = textP.text().trim();

    if (!reviewText) continue;

    const isSpoiler = card.hasClass('has-spoiler') || textP.hasClass('spoiler-hidden');
    const likes = card.find('.btn-like .count').text().trim() || '0';
    const dislikes = card.find('.btn-dislike .count').text().trim() || '0';
    
    let repliesCount = 0;
    const repliesSpanText = card.find('.btn-reply .count').text().trim();
    if (repliesSpanText.includes('(') && repliesSpanText.includes(')')) {
      try {
        const countStr = repliesSpanText.split('(')[1].split(')')[0];
        repliesCount = parseInt(countStr, 10);
      } catch (e) {}
    }

    let replies: any[] = [];
    if (includeReplies && repliesCount > 0 && !reviewId.startsWith('temp_')) {
      try {
        let repliesApiUrl = '';
        if (targetUrl.includes('Episodes.aspx')) {
          const urlObj = new URL(targetUrl);
          const typeId = urlObj.searchParams.get('type');
          if (typeId) {
            repliesApiUrl = `${BASE_URL}/Episodes.aspx?type=${typeId}&action=getReplies&reviewId=${reviewId}`;
          }
        } else {
          repliesApiUrl = `${BASE_URL}/moves-details.aspx?action=getReplies&reviewId=${reviewId}`;
        }

        if (repliesApiUrl) {
          const repliesData = await fetchWithProxy(repliesApiUrl, true);
          if (repliesData && repliesData.replies) {
            replies = repliesData.replies.map((reply: any) => ({
              user_name: (reply.userName || '').trim(),
              user_code: (reply.userCode || '').trim(),
              user_photo: reply.userPhoto ? `${BASE_URL}/User_Photos/${reply.userPhoto}` : '',
              date: (reply.date || '').trim(),
              text: (reply.text || '').trim(),
              is_spoiler: !!reply.isSpoiler
            }));
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch replies for review ${reviewId}:`, e);
      }
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
      replies_count: replies.length > 0 ? replies.length : repliesCount,
      replies
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
