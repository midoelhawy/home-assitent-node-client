import { HomeAssistantHttpError } from "./errors.js";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export interface HttpClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export class HttpClient {
  readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get apiRoot(): string {
    return `${this.baseUrl}/api`;
  }

  async requestJson<T>(
    method: string,
    path: string,
    options?: { query?: Record<string, string | undefined>; body?: unknown },
  ): Promise<T> {
    const url = new URL(path.startsWith("http") ? path : `${this.apiRoot}${path}`);
    if (options?.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined) url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
    };

    let body: string | undefined;
    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), { method, headers, body });
    } catch (err) {
      throw new HomeAssistantHttpError(
        `Network error while calling ${url.pathname}`,
        undefined,
        undefined,
        { cause: err },
      );
    }

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      throw new HomeAssistantHttpError(
        `Home Assistant HTTP ${res.status} ${res.statusText} for ${method} ${url.pathname}`,
        res.status,
        parsed,
      );
    }

    return parsed as T;
  }

  getJson<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    return this.requestJson<T>("GET", path, { query });
  }

  postJson<T>(path: string, body?: unknown): Promise<T> {
    return this.requestJson<T>("POST", path, { body });
  }
}
