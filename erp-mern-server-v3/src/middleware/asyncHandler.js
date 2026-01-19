// Small helper to wrap async route handlers and forward errors to Express error handler
export const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
