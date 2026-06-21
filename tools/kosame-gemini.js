'use strict';

// KOSAME Gemini caller — analyzes YouTube videos via Google Gemini API.
// Gate: GEMINI_API_KEY must be present in process.env.
// API key value is NEVER logged.

const https = require('node:https');

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_TIMEOUT_MS = 10000;
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
  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: 'この動画の内容を詳しく教えてください。' },
        { file_data: { mime_type: 'video/*', file_uri: url } },
      ],
    }],
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
        try {
          const data = JSON.parse(raw);
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (text) {
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

    req.write(body);
    req.end();
  });
}

module.exports = { askGeminiAboutYouTube, isKeyPresent, GEMINI_TIMEOUT_MS };
