/**
 * Sign-in for the hosted server. Callers send a bearer token: an organization API key
 * ("fr_...") or the access token of an OAuth sign-in (a user JWT). The FirstReply API is the
 * authorization server; this server is only the protected resource, so all it does is point
 * MCP hosts there (401 with resource_metadata, the discovery documents) and refuse a token
 * that has expired, which tells the host to refresh it. The API checks every token itself.
 */

const DEFAULT_SERVER_URL = 'https://mcp.firstreply.ai';
const DEFAULT_API_URL = 'https://api.firstreply.ai';

const trimSlash = (url: string): string => url.replace(/\/+$/, '');

/** The public address of this server: the OAuth resource identifier. */
export function serverUrl(): string {
  return trimSlash(process.env.MCP_SERVER_URL ?? DEFAULT_SERVER_URL);
}

export function apiUrl(): string {
  return trimSlash(process.env.FIRSTREPLY_API_URL ?? DEFAULT_API_URL);
}

/** Protected resource metadata (RFC 9728): where an MCP host's OAuth discovery starts. */
export function protectedResourceMetadata(): Record<string, unknown> {
  return {
    resource: serverUrl(),
    authorization_servers: [apiUrl()],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://docs.firstreply.ai/developers/mcp-server',
  };
}

/** Anything outside printable ASCII would make setHeader throw; quotes end the parameter. */
const quote = (value: string): string => value.replace(/[^\x20-\x7e]/g, ' ').replace(/[\\"]/g, '\\$&');

/** WWW-Authenticate for a 401 (RFC 6750 section 3, RFC 9728 section 5.1). */
export function wwwAuthenticate(error?: string, description?: string): string {
  const params = [`resource_metadata="${quote(`${serverUrl()}/.well-known/oauth-protected-resource`)}"`];
  if (error) params.push(`error="${quote(error)}"`);
  if (description) params.push(`error_description="${quote(description)}"`);
  return `Bearer ${params.join(', ')}`;
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** The exp claim of a JWT in seconds; null for an API key or anything that is not a JWT. */
export function jwtExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export interface AuthChallenge {
  error?: 'invalid_token';
  description?: string;
}

/**
 * Why a POST to the MCP endpoint is answered with 401, or null when it may pass.
 * No token: MCP hosts only start their sign-in on a 401. An expired access token:
 * invalid_token, so the host refreshes it instead of failing every tool call.
 */
export function authChallenge(token: string | null, nowMs: number = Date.now()): AuthChallenge | null {
  if (!token) return {};
  const exp = jwtExpiry(token);
  if (exp !== null && exp * 1000 <= nowMs) {
    return { error: 'invalid_token', description: 'The access token expired' };
  }
  return null;
}

/**
 * A document of the authorization server, served from this origin: clients of the 2025-03-26
 * MCP spec look for the authorization server metadata here. It is the API's live document,
 * kept for an hour; when a refresh fails the last copy is served and the next attempt waits a
 * minute, and without any copy the answer is 502.
 */
export function documentProxy(
  url: string,
  { ttlMs = 3_600_000, fetchFn = fetch, now = Date.now }: { ttlMs?: number; fetchFn?: typeof fetch; now?: () => number } = {},
): () => Promise<{ status: number; body: unknown }> {
  let cached: { body: unknown; fetchedAt: number } | null = null;
  return async () => {
    if (cached && now() - cached.fetchedAt < ttlMs) {
      return { status: 200, body: cached.body };
    }
    try {
      const response = await fetchFn(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      cached = { body: await response.json(), fetchedAt: now() };
      return { status: 200, body: cached.body };
    } catch (error) {
      console.error(`[OAuth] Could not load ${url}:`, error);
      if (cached) {
        cached.fetchedAt = now() - ttlMs + 60_000;
        return { status: 200, body: cached.body };
      }
      return {
        status: 502,
        body: { error: 'temporarily_unavailable', error_description: 'The authorization server metadata could not be loaded' },
      };
    }
  };
}
