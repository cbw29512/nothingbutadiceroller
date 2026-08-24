export class PublicApiError extends Error {
  constructor(message, { status = 400, code = 'invalid-request', details = null } = {}) {
    super(message);
    this.name = 'PublicApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function publicError(message, options = {}) {
  return new PublicApiError(message, options);
}

export function apiErrorResponse(error, fallback = 'Request failed.') {
  if (error instanceof PublicApiError) {
    const body = { error: error.message, code: error.code };
    if (error.details != null) body.details = error.details;
    return { status: error.status, body };
  }
  const status = Number(error?.status || error?.statusCode);
  if (status === 403) {
    return {
      status: 403,
      body: { error: 'Request origin is not allowed.', code: 'origin-not-allowed' },
    };
  }
  return {
    status: Number.isInteger(status) && status >= 400 && status < 500 ? status : 500,
    body: { error: fallback, code: 'request-failed' },
  };
}