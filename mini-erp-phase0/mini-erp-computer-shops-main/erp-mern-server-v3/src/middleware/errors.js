export function notFound(_req, res, _next) {
  res.status(404).json({ message: 'Not Found' });
}
export function errorHandler(err, _req, res, _next) {
  console.error('[ERR]', err);
  const code = err.status || err.statusCode || 500;
  res.status(code).json({ message: err.message || 'Server error' });
}
