'use strict';

function parseVersion(value) {
  return String(value || '')
    .replace(/^v/, '')
    .split('.')
    .map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isVersionAtLeast(version, minimum) {
  return compareVersions(version, minimum) >= 0;
}

module.exports = {
  compareVersions,
  isVersionAtLeast,
};
