/**
 * Global Error Handling Middleware
 */

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status;
  if (!statusCode) {
    if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 400;
    } else {
      statusCode = 500;
    }
  }

  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'Image file size must be less than 5 MB.'
    : (err.message || 'Internal Server Error');

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message || err);

  res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
