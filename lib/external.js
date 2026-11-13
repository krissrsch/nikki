// Which links Nikki hands to the system browser. The text of a chat can contain any link, and the click comes from the page.
const MAX_URL = 2048;

// The URL to open, or null: only http(s), no user:password@ in front of the host (a classic disguise for a fake
// address), no control characters, a sane length. Returns the normalised form, which is what the browser will get.
export function externalUrl(url) {
  if (typeof url !== 'string' || url.length > MAX_URL || /[\u0000-\u001f\u007f]/.test(url)) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password || !u.hostname) return null;
  return u.href;
}
