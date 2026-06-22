'use strict';

// KOSAME Gemini caller — analyzes YouTube videos via Google Gemini API.
// Gate: GEMINI_API_KEY must be present in process.env.
// API key value is NEVER logged.

const https = require('node:https');

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 30000;
const GEMINI_KEY_CHECK_TIMEOUT_MS = 5000;
const GEMINI_HOST = 'generativelanguage.googleapis.com';

function isKeyPresent() {
  return typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.length > 0;
}

/**
 * Call Gemini API to analyze a YouTube video.
 * @param {string} url - YouTube URL
 * @param {number} [timeoutMs]
 * @returns {Promise<{ text: string|null, error: string|null, timedOut: boolean }>}
 */
async function askGeminiAboutYouTube(url, timeoutMs = GEMINI_TIMEOUT_MS) {
  process.stderr.write('[Gemini] fetching YouTube...\n');

  if (!isKeyPresent()) {
    process.stderr.write('[Gemini] error: GEMINI_API_KEY not set\n');
    return { text: null, error: 'GEMINI_API_KEY not set', timedOut: false };
  }

  const key = process.env.GEMINI_API_KEY;
  const prompt = `この動画について教えて：${url}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1000 },
  });

  return new Promise((resolve) => {
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        req.destroy();
        process.stderr.write('[Gemini] timeout\n');
        resolve({ text: null, error: 'timeout', timedOut: true });
      }
    }, timeoutMs);

    const req = https.request({
      hostname: GEMINI_HOST,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        process.stderr.write('[Gemini] response received\n');
        try {
          const data = JSON.parse(raw);
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (text) {
            process.stderr.write(`[Gemini] response: ${text.slice(0, 100)}\n`);
            process.stderr.write('[Gemini] done\n');
            resolve({ text, error: null, timedOut: false });
          } else {
            const errMsg = data?.error?.message || 'empty response';
            process.stderr.write(`[Gemini] error: ${errMsg}\n`);
            resolve({ text: null, error: errMsg, timedOut: false });
          }
        } catch (e) {
          process.stderr.write(`[Gemini] error: ${e.message}\n`);
          resolve({ text: null, error: e.message, timedOut: false });
        }
      });
    });

    req.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      process.stderr.write(`[Gemini] error: ${e.message}\n`);
      resolve({ text: null, error: e.message, timedOut: false });
    });

    process.stderr.write('[Gemini] request sent\n');
    req.write(body);
    req.end();
  });
}

/**
 * Analyze an image attachment via Gemini Vision.
 * @param {string} base64DataUrl - data:image/TYPE;base64,DATA
 * @param {string} [hint] - optional filename / context hint
 * @param {number} [timeoutMs]
 * @returns {Promise<{ text: string|null, error: string|null }>}
 */
async function analyzeImageWithGemini(base64DataUrl, hint, timeoutMs = GEMINI_TIMEOUT_MS) {
  if (!isKeyPresent()) {
    return { text: null, error: 'GEMINI_API_KEY not set' };
  }
  const idx = String(base64DataUrl).indexOf(',');
  const prefix = idx >= 0 ? base64DataUrl.slice(5, idx) : '';
  const mimeType = prefix.replace(/;base64$/, '') || 'image/png';
  const data = idx >= 0 ? base64DataUrl.slice(idx + 1) : base64DataUrl;
  const promptText = hint ? `この画像（${hint}）について詳しく説明してください。` : 'この画像について詳しく説明してください。';
  const key = process.env.GEMINI_API_KEY;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data } }] }],
    generationConfig: { maxOutputTokens: 1000 },
  });
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; req.destroy(); resolve({ text: null, error: 'timeout' }); }
    }, timeoutMs);
    const req = https.request({
      hostname: GEMINI_HOST,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(raw);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || null;
          resolve({ text, error: text ? null : (parsed?.error?.message || 'empty response') });
        } catch (e) { resolve({ text: null, error: e.message }); }
      });
    });
    req.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); resolve({ text: null, error: e.message }); });
    req.write(body);
    req.end();
  });
}

/**
 * Validate GEMINI_API_KEY by calling the models list endpoint.
 * Logs [Gemini] API key valid / invalid at startup.
 * @returns {Promise<void>}
 */
async function checkGeminiApiKey() {
  if (!isKeyPresent()) {
    process.stderr.write('[Gemini] API key invalid: GEMINI_API_KEY not set\n');
    return;
  }
  const key = process.env.GEMINI_API_KEY;
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        req.destroy();
        process.stderr.write('[Gemini] API key invalid: timeout\n');
        resolve();
      }
    }, GEMINI_KEY_CHECK_TIMEOUT_MS);

    const req = https.request({
      hostname: GEMINI_HOST,
      path: `/v1beta/models?key=${key}`,
      method: 'GET',
    }, (res) => {
      res.resume();
      res.on('end', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (res.statusCode === 200) {
          process.stderr.write('[Gemini] API key valid\n');
        } else {
          process.stderr.write(`[Gemini] API key invalid: HTTP ${res.statusCode}\n`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      process.stderr.write(`[Gemini] API key invalid: ${e.message}\n`);
      resolve();
    });

    req.end();
  });
}

// Run key validation at module load (non-blocking)
checkGeminiApiKey().catch(() => {});

module.exports = { askGeminiAboutYouTube, analyzeImageWithGemini, checkGeminiApiKey, isKeyPresent, GEMINI_TIMEOUT_MS };
