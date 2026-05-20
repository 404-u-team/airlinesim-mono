export class ApiRequestError extends Error {
  readonly data: unknown;

  readonly status: null | number;

  constructor(message: string, status: null | number, data: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
  }
}
