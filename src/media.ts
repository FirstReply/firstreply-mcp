/**
 * Fetching a media file from a public https address and sending it on to a signed
 * upload URL, without keeping it in memory.
 *
 * The hosted server fetches addresses its callers name, so only public hosts are
 * reached: the check sits in the DNS lookup of the connection itself (not in a
 * lookup beforehand, which a second DNS answer could bypass) and runs again for
 * every redirect.
 */

import { lookup as dnsLookup } from 'node:dns';
import type { LookupAddress } from 'node:dns';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';
import { pipeline } from 'node:stream/promises';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 30_000;
// Many hosts refuse requests without a user agent; identity keeps Content-Length the file's size.
const REQUEST_HEADERS = { 'User-Agent': 'FirstReply-MCP', Accept: '*/*', 'Accept-Encoding': 'identity' };

/** Whether an IP address is on the public internet (not loopback, private, link-local, ...). */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPublicAddress(mapped[1]);
    // Global unicast is 2000::/3; everything else (loopback, unique local, link-local,
    // mapped and translated ranges) is not a public host.
    // 2002::/16 (6to4) and 2001:db8::/32 (documentation) are left out: the first wraps an IPv4 address.
    return /^[23]/.test(lower) && !lower.startsWith('2001:db8') && !lower.startsWith('2002:');
  }
  return false;
}

/** The DNS lookup of a connection, failing when the host resolves to a non-public address. */
const publicLookup: typeof dnsLookup = ((hostname: string, options: object, callback: Function) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((entry) => !isPublicAddress(entry.address))) {
      return callback(new Error(`${hostname} is not a public address.`));
    }
    return (options as { all?: boolean }).all ? callback(null, list) : callback(null, list[0].address, list[0].family);
  });
}) as unknown as typeof dnsLookup;

function publicHttpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid URL "${value}".`);
  }
  if (url.protocol !== 'https:') {
    throw new Error('The file has to be at a public https:// address.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicAddress(host)) {
    throw new Error(`${url.hostname} is not a public address.`);
  }
  return url;
}

export interface RemoteFile {
  stream: IncomingMessage;
  contentType: string | undefined;
  size: number;
  fileName: string;
}

/** Opens a file at a public https address. The caller reads or destroys the stream. */
export async function openRemoteFile(value: string): Promise<RemoteFile> {
  let url = publicHttpsUrl(value);
  for (let redirects = 0; ; redirects++) {
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      https
        .get(url, { lookup: publicLookup, timeout: TIMEOUT_MS, headers: REQUEST_HEADERS }, resolve)
        .on('timeout', function (this: { destroy(error: Error): void }) {
          this.destroy(new Error(`${url.hostname} did not answer in time.`));
        })
        .on('error', reject);
    });
    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.destroy();
      if (redirects >= MAX_REDIRECTS) throw new Error('Too many redirects.');
      url = publicHttpsUrl(new URL(response.headers.location, url).toString());
      continue;
    }
    if (status !== 200) {
      response.destroy();
      throw new Error(`The file could not be fetched (${status}).`);
    }
    const size = Number(response.headers['content-length']);
    if (!Number.isInteger(size) || size <= 0) {
      response.destroy();
      throw new Error('The server does not say how large the file is (no Content-Length), so it cannot be uploaded from this address.');
    }
    return {
      stream: response,
      contentType: response.headers['content-type']?.split(';')[0].trim().toLowerCase() || undefined,
      size,
      fileName: decodeURIComponent(url.pathname.split('/').pop() || '') || 'file',
    };
  }
}

/** Sends a stream of a known size to a signed upload URL. */
export async function putStream(
  uploadUrl: string,
  headers: Record<string, string>,
  body: IncomingMessage,
  size: number,
): Promise<void> {
  const request = https.request(uploadUrl, { method: 'PUT', headers: { ...headers, 'Content-Length': size } });
  const answered = new Promise<void>((resolve, reject) => {
    request.on('error', reject);
    request.on('response', (response) => {
      response.resume();
      const status = response.statusCode ?? 0;
      if (status >= 200 && status < 300) resolve();
      else reject(new Error(`The upload was refused (${status}).`));
    });
  });
  await Promise.all([pipeline(body, request), answered]);
}
