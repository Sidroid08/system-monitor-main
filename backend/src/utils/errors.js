export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export const badRequest  = (msg = 'Bad request')  => new ApiError(400, msg);
export const unauthorized = (msg = 'Unauthorized') => new ApiError(401, msg);
export const forbidden   = (msg = 'Forbidden')     => new ApiError(403, msg);
export const notFound    = (msg = 'Not found')     => new ApiError(404, msg);
export const conflict    = (msg = 'Conflict')      => new ApiError(409, msg);
