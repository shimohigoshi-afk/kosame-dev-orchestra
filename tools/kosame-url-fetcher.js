'use strict';

// URL content fetcher for KOSAME CHAT.
// Fetches page content (HTML→text), YouTube transcripts, detects login-required pages.
// Uses only Node.js built-ins — no axios/puppeteer required.

const https = require('node:https');
const http = require('node:http');

const FETCH_TIMEOUT_MS = 9000;
const YOUTUBE_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 600000;
const MAX_REDIRECTS = 4;

function _fetchRaw(url, timeoutMs, redirectCount = 0) {
  return new Promise((resolve) => {
    if (redirectCount > MAX_REDIRECTS) {
      resolve({ ok: false, text: '', status: 0, error: 'too many redirects' });
      return;
    }
    let parsed;
    try { parsed = new URL(url); } catch {
      resolve({ ok: false, text: '', status: 0, error: 'invalid URL' });
      return;
    }
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KosameBot/1.0; +https://kosame.ai)',
        'Accept': 'text/html,text/plain,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Connection': 'close',
      },
      timeout: timeoutMs,
    };

    let done = false;
    const req = lib.request(options, (res) => {
      const loc = res.headers.location;
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) && loc) {
        req.destroy();
        const next = loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.host}${loc}`;
        _fetchRaw(next, timeoutMs, redirectCount + 1).then(resolve);
        return;
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        done = true;
        resolve({ ok: false, text: '', status: res.statusCode, loginRequired: true });
        res.resume();
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY_BYTES) { req.destroy(); }
      });
      res.on('end', () => {
        if (!done) { done = true; resolve({ ok: true, text: body, status: res.statusCode }); }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (!done) { done = true; resolve({ ok: false, text: '', status: 0, error: 'timeout' }); }
    });
    req.on('error', (e) => {
      if (!done) { done = true; resolve({ ok: false, text: '', status: 0, error: e.message }); }
    });
    req.end();
  });
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]{0,2000}>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isYouTubeUrl(url) {
  return /(?:youtube\.com\/(?:watch|shorts)|youtu\.be\/)/i.test(String(url || ''));
}

function extractYouTubeVideoId(url) {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function _doFetchYouTubeTranscript(videoId, perReqTimeoutMs) {
  const page = await _fetchRaw(`https://www.youtube.com/watch?v=${videoId}`, perReqTimeoutMs);
  if (!page.ok || !page.text) return { transcript: null, title: null, error: page.error || 'page fetch failed' };

  const titleMatch = page.text.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const title = titleMatch ? htmlToText(titleMatch[1]).replace(/\s*[-–]\s*YouTube$/i, '').trim().slice(0, 120) : null;

  const pmMatch = page.text.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]{0,300000}?\});(?:\s*(?:var |<\/script>))/);
  if (!pmMatch) return { transcript: null, title };

  let playerData;
  try { playerData = JSON.parse(pmMatch[1]); } catch { return { transcript: null, title }; }

  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(tracks) || !tracks.length) return { transcript: null, title };

  const track = tracks.find((t) => t.languageCode === 'ja')
    || tracks.find((t) => t.languageCode === 'en')
    || tracks[0];
  if (!track?.baseUrl) return { transcript: null, title };

  const xmlFetch = await _fetchRaw(`${track.baseUrl}&fmt=json3`, perReqTimeoutMs);
  if (!xmlFetch.ok || !xmlFetch.text) return { transcript: null, title };

  try {
    const data = JSON.parse(xmlFetch.text);
    const lines = (data?.events || [])
      .filter((e) => Array.isArray(e.segs))
      .map((e) => e.segs.map((s) => s.utf8 || '').join('').trim())
      .filter(Boolean);
    return { transcript: lines.join(' ').slice(0, 8000) || null, title };
  } catch { return { transcript: null, title }; }
}

async function fetchYouTubeTranscript(videoId, timeoutMs = YOUTUBE_TIMEOUT_MS) {
  process.stderr.write('[YouTube] fetching captions...\n');
  const timedOutResult = { transcript: null, title: null, timedOut: true };
  const totalTimeoutPromise = new Promise((resolve) => setTimeout(() => resolve(timedOutResult), timeoutMs));
  let result;
  try {
    result = await Promise.race([totalTimeoutPromise, _doFetchYouTubeTranscript(videoId, timeoutMs)]);
    if (result.timedOut) {
      process.stderr.write('[YouTube] timeout\n');
    } else {
      process.stderr.write(`[YouTube] done transcript=${!!result.transcript} title=${!!result.title}\n`);
    }
  } catch (e) {
    process.stderr.write(`[YouTube] error: ${e && e.message ? e.message : String(e)}\n`);
    result = { transcript: null, title: null, error: e && e.message ? e.message : String(e) };
  }
  return result;
}

function _looksLoginRequired(html, statusCode) {
  if (statusCode === 401 || statusCode === 403) return true;
  const head = String(html || '').slice(0, 3000).toLowerCase();
  if (/(?:login|sign.?in|log.?in|ログイン|サインイン|認証が必要)/.test(head) &&
      !/<(?:article|main|section)[^>]*>/i.test(html.slice(0, 5000))) return true;
  return false;
}

/**
 * Analyze a URL: fetch content, detect YouTube/login-required.
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<{
 *   url: string,
 *   text: string|null,
 *   title: string|null,
 *   youtubeTranscript: string|null,
 *   isYouTube: boolean,
 *   loginRequired: boolean,
 *   error: string|null,
 * }>}
 */
async function analyzeUrl(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const result = {
    url, text: null, title: null, youtubeTranscript: null,
    isYouTube: false, loginRequired: false, timedOut: false, error: null,
  };

  if (isYouTubeUrl(url)) {
    result.isYouTube = true;
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      const ytResult = await fetchYouTubeTranscript(videoId, YOUTUBE_TIMEOUT_MS);
      result.youtubeTranscript = ytResult.transcript || null;
      result.title = ytResult.title || null;
      result.timedOut = !!ytResult.timedOut;
    }
    return result;
  }

  const fetched = await _fetchRaw(url, timeoutMs);
  if (fetched.loginRequired) { result.loginRequired = true; return result; }
  if (!fetched.ok) {
    result.error = fetched.error || `HTTP ${fetched.status}`;
    return result;
  }

  if (_looksLoginRequired(fetched.text, fetched.status)) {
    result.loginRequired = true;
    return result;
  }

  const titleMatch = fetched.text.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  result.title = titleMatch ? htmlToText(titleMatch[1]).slice(0, 120) : null;
  result.text = htmlToText(fetched.text).slice(0, 6000);
  return result;
}

module.exports = { analyzeUrl, htmlToText, isYouTubeUrl, extractYouTubeVideoId, fetchYouTubeTranscript };
