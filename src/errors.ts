export class HomeAssistantError extends Error {
  override name: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "HomeAssistantError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class HomeAssistantHttpError extends HomeAssistantError {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "HomeAssistantHttpError";
  }
}

export class WebSocketNotConnectedError extends HomeAssistantError {
  constructor(message = "WebSocket is not connected.") {
    super(message);
    this.name = "WebSocketNotConnectedError";
  }
}
