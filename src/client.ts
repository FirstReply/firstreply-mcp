/**
 * Minimal HTTP client for the FirstReply REST API.
 *
 * Authenticates with `Authorization: Bearer <token>` where the token is either
 * an organization API key ("fr_...") or a user JWT — both are accepted by the
 * backend's AuthenticationFilter.
 */

import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

const DEFAULT_BASE_URL = 'https://api.firstreply.ai';

/** A file to upload: its bytes as a stream, with the size and type known up front. */
export interface UploadFile {
  stream: AsyncIterable<Uint8Array>;
  size: number;
  contentType: string;
  fileName: string;
}

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

  delete(path: string): Promise<unknown> {
    return this.send('DELETE', path);
  }

  /**
   * POSTs a file as multipart form data (parts `file` and `fileSize`), streamed: the
   * file is never held in memory.
   */
  postFile(path: string, file: UploadFile): Promise<unknown> {
    const boundary = `----firstreply-${randomUUID()}`;
    const fileName = file.fileName.replace(/[\r\n"\\]/g, '_');
    const head =
      `--${boundary}\r\nContent-Disposition: form-data; name="fileSize"\r\n\r\n${file.size}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${file.contentType}\r\n\r\n`;
    const parts = async function* (): AsyncGenerator<Uint8Array> {
      yield Buffer.from(head);
      yield* file.stream;
      yield Buffer.from(`\r\n--${boundary}--\r\n`);
    };
    return this.request('POST', path, {
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: Readable.toWeb(Readable.from(parts())) as unknown as RequestInit['body'],
      duplex: 'half',
    });
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

  private send(method: string, path: string, body?: unknown): Promise<unknown> {
    return this.request(method, path, {
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async request(method: string, path: string, init: RequestInit & { duplex?: 'half' }): Promise<unknown> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        ...(init.headers as Record<string, string>),
      },
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
