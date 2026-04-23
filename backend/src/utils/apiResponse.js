export function ok(res, data = {}, message = 'ok', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function fail(res, message = 'error', status = 400, errors = undefined) {
  return res.status(status).json({ success: false, message, errors });
}
