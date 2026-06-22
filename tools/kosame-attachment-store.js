'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_ATTACHMENT_ROOT = path.join(ROOT, '.kosame-handoff', 'attachments');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeFileName(name, fallback = 'attachment') {
  const value = normalizeText(name) || fallback;
  return path.basename(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || fallback;
}

function sanitizePathSegment(value, fallback = 'work-order') {
  const text = sanitizeFileName(value, fallback);
  return text.replace(/[.\s]+$/g, '').slice(0, 120) || fallback;
}

function maskSensitiveText(text) {
  return normalizeText(text)
    .replace(/\bSecret\b/gi, '[secret]')
    .replace(/\.env\b/gi, '[env]')
    .replace(/\bcredentials?\b/gi, '[credentials]')
    .replace(/\btoken\b/gi, '[token]')
    .replace(/\bpassword\b/gi, '[password]')
    .replace(/\bauthorization\b/gi, '[authorization]')
    .replace(/\bbearer\b/gi, '[bearer]')
    .replace(/\bAPI[_-]?KEY\b/gi, 'API_KEY');
}

function isLikelyBase64Blob(text) {
  const value = normalizeText(text);
  if (!value) return false;
  if (/^data:[^,]+;base64,[A-Za-z0-9+/=\s_-]{80,}$/i.test(value)) return true;
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 120) return false;
  return /^(?:[A-Za-z0-9+/]{120,}={0,2})$/.test(compact);
}

function stripBase64Payloads(text, replacements = []) {
  const source = String(text || '');
  let index = 0;
  let strippedCount = 0;
  let output = source.replace(/data:[^,\s]+;base64,[A-Za-z0-9+/=\s_-]{80,}/gi, () => {
    const replacement = replacements[index] || `[attachment:${index + 1}]`;
    index += 1;
    strippedCount += 1;
    return replacement;
  });
  output = output.replace(/(?:^|\s)([A-Za-z0-9+/]{160,}={0,2})(?=\s|$)/g, (match) => {
    if (!isLikelyBase64Blob(match)) return match;
    strippedCount += 1;
    return replacements[index] || `[attachment:${index + 1}]`;
  });
  return {
    text: output,
    strippedCount,
  };
}

function guessKind(attachment = {}) {
  const mimeType = normalizeText(attachment.mimeType || attachment.mime_type || '');
  const ext = normalizeText(attachment.ext || attachment.extension || '').toLowerCase();
  if (mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image';
  if (mimeType.startsWith('text/') || ['.txt', '.md'].includes(ext)) return 'text';
  if (['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'].includes(ext)) return 'document';
  return 'binary';
}

function decodeDataUrl(dataUrl) {
  const value = normalizeText(dataUrl);
  const commaIndex = value.indexOf(',');
  const header = commaIndex >= 0 ? value.slice(0, commaIndex) : '';
  const body = commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  return {
    mimeType: mimeMatch ? mimeMatch[1] : 'application/octet-stream',
    buffer: Buffer.from(body, 'base64'),
  };
}

function sanitizeAttachmentForHandoff(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const attachmentId = sanitizeFileName(
    source.attachmentId || source.id || source.attachment_id || source.name || `attachment-${crypto.randomUUID()}`,
    `attachment-${crypto.randomUUID()}`,
  ).replace(/\s+/g, '_');
  const originalName = sanitizeFileName(source.originalName || source.displayName || source.name || attachmentId, attachmentId);
  const displayName = maskSensitiveText(originalName);
  const mimeType = normalizeText(source.mimeType || source.mime_type || 'application/octet-stream').slice(0, 120) || 'application/octet-stream';
  const size = Number.isFinite(Number(source.size)) ? Number(source.size) : 0;
  const ext = normalizeText(source.ext || path.extname(originalName)).toLowerCase().slice(0, 12);
  const kind = normalizeText(source.kind || guessKind({ mimeType, ext })) || guessKind({ mimeType, ext });
  const base64DataUrl = typeof source.base64DataUrl === 'string' ? source.base64DataUrl : '';
  const textContent = typeof source.textContent === 'string' ? source.textContent : '';
  const textPreview = normalizeText(source.textPreview || source.preview || '');
  const createdAt = normalizeText(source.createdAt || source.created_at || options.createdAt || new Date().toISOString());
  const workOrderId = normalizeText(source.workOrderId || source.work_order_id || options.workOrderId || '');
  const storedPath = normalizeText(source.storedPath || source.payloadPath || '');
  const sourcePath = normalizeText(source.sourcePath || source.localPath || '');
  const bytes = base64DataUrl
    ? decodeDataUrl(base64DataUrl).buffer
    : Buffer.from(textContent || '', 'utf8');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const hasImageData = kind === 'image' && !!base64DataUrl;

  return {
    attachmentId,
    originalName,
    displayName,
    mimeType,
    size,
    kind,
    ext,
    textPreview,
    createdAt,
    workOrderId,
    storedPath,
    sourcePath,
    sha256,
    hasImageData,
    base64DataUrl,
    textContent,
  };
}

function buildAttachmentManifest(workOrderId, attachments = [], options = {}) {
  const safeWorkOrderId = sanitizePathSegment(workOrderId || options.workOrderId || 'work-order');
  const attachmentDir = path.resolve(String(options.attachmentDir || path.join(DEFAULT_ATTACHMENT_ROOT, safeWorkOrderId)));
  const manifestPath = path.join(attachmentDir, 'manifest.json');
  const createdAt = normalizeText(options.createdAt || new Date().toISOString());
  const items = [];

  fs.mkdirSync(attachmentDir, { recursive: true, mode: 0o700 });

  for (const attachment of Array.isArray(attachments) ? attachments : []) {
    const safe = sanitizeAttachmentForHandoff(attachment, { workOrderId: safeWorkOrderId, createdAt });
    const payloadPath = path.join(attachmentDir, `${safe.attachmentId}.json`);
    const payload = {
      attachmentId: safe.attachmentId,
      originalName: safe.originalName,
      displayName: safe.displayName,
      mimeType: safe.mimeType,
      size: safe.size,
      kind: safe.kind,
      ext: safe.ext,
      textPreview: safe.textPreview,
      createdAt: safe.createdAt,
      workOrderId: safe.workOrderId || safeWorkOrderId,
      sha256: safe.sha256,
      sourcePath: safe.sourcePath || '',
      base64DataUrl: safe.base64DataUrl || '',
      textContent: safe.textContent || '',
    };
    fs.writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    items.push({
      attachmentId: safe.attachmentId,
      originalName: safe.originalName,
      displayName: safe.displayName,
      mimeType: safe.mimeType,
      size: safe.size,
      kind: safe.kind,
      storedPath: payloadPath,
      sha256: safe.sha256,
      createdAt: safe.createdAt,
      workOrderId: safe.workOrderId || safeWorkOrderId,
    });
  }

  const manifest = {
    workOrderId: safeWorkOrderId,
    attachmentCount: items.length,
    createdAt,
    attachments: items,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    workOrderId: safeWorkOrderId,
    createdAt,
    attachmentDir,
    manifestPath,
    attachments: items,
  };
}

function saveAttachmentPayload(workOrderId, attachments = [], options = {}) {
  return buildAttachmentManifest(workOrderId, attachments, options);
}

function buildSafeHandoffAttachmentSummary(manifest = {}) {
  const attachments = Array.isArray(manifest.attachments) ? manifest.attachments : [];
  if (!attachments.length) return [];
  const lines = [
    `- attachment_count: ${attachments.length}`,
    `- attachment_manifest: ${normalizeText(manifest.manifestPath || '')}`,
  ];
  const imageCount = attachments.filter((att) => att.kind === 'image').length;
  if (imageCount > 0) {
    lines.push(`- 画像添付あり: ${imageCount}件`);
  }
  for (const att of attachments) {
    lines.push(`- [attachment:${att.attachmentId}] ${att.displayName || att.originalName} (${att.mimeType || 'application/octet-stream'} · ${att.size || 0}B)`);
    lines.push(`  - storedPath: ${normalizeText(att.storedPath || '')}`);
  }
  return lines;
}

function lintHandoffTextOnly(text, attachmentRefs = []) {
  const replacements = Array.isArray(attachmentRefs)
    ? attachmentRefs.map((ref, index) => {
        const id = normalizeText(ref && (ref.attachmentId || ref.id || ref)) || `attachment-${index + 1}`;
        return `[attachment:${id}]`;
      })
    : [];
  const stripped = stripBase64Payloads(text, replacements);
  return {
    text: stripped.text,
    strippedBase64Count: stripped.strippedCount,
    isLikelyBase64Blob,
  };
}

module.exports = {
  DEFAULT_ATTACHMENT_ROOT,
  buildAttachmentManifest,
  buildSafeHandoffAttachmentSummary,
  lintHandoffTextOnly,
  isLikelyBase64Blob,
  sanitizeAttachmentForHandoff,
  sanitizeFileName,
  saveAttachmentPayload,
  maskSensitiveText,
  stripBase64Payloads,
};
