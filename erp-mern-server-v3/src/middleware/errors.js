export function notFound(req,res,next){
  res.status(404).json({ message: 'Not Found' })
}
export function errorHandler(err,req,res,next){
  console.error('[ERR]', err)
  const code = err.status || err.statusCode || 500
  res.status(code).json({ message: err.message || 'Server error' })
}
