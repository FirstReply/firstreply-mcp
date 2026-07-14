/**
 * Minimal HTTP client for the FirstReply REST API.
 *
 * Authenticates with `Authorization: Bearer <token>` where the token is either
 * an organization API key ("fr_...") or a user JWT — both are accepted by the
 * backend's AuthenticationFilter.
 */

const DEFAULT_BASE_URL = 'https://api.firstreply.ai';

export class FirstReplyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorType: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'FirstReplyApiError';
  }
}

export class FirstReplyClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(token: string, baseUrl?: string) {
    this.token = token;
    this.baseUrl = (baseUrl ?? process.env.FIRSTREPLY_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  get(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    return this.send('GET', this.withQuery(path, query));
  }

  post(path: string, body?: unknown): Promise<unknown> {
    return this.send('POST', path, body);
  }

  put(path: string, body?: unknown): Promise<unknown> {
    return this.send('PUT', path, body);
  }

  private withQuery(path: string, query?: Record<string, string | number | undefined>): string {
    if (!query) return path;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    const encoded = params.toString();
    return encoded ? `${path}?${encoded}` : path;
  }

  private async send(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(this.baseUrl + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      let errorType: string | undefined;
      let message = text || response.statusText;
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string };
        errorType = parsed.error;
        message = parsed.message ?? message;
      } catch {
        // non-JSON error body, keep raw text
      }
      throw new FirstReplyApiError(response.status, errorType, `FirstReply API ${method} ${path} failed (${response.status}): ${message}`);
    }

    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }
}
