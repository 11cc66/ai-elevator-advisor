const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,100}$/;

export function getRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id");

  if (supplied && REQUEST_ID_PATTERN.test(supplied)) {
    return supplied;
  }

  return crypto.randomUUID();
}
