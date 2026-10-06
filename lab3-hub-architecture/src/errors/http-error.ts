import { ErrorResponse } from '../types/reservation';

/**
 * Domain failure that a controller turns into an HTTP response.
 * Services throw this. They never touch Express `req` or `res`.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }

  toResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
    };
  }
}
