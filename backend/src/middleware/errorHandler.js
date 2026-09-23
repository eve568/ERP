export function notFoundHandler(request, response) {
  response.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
}

export function errorHandler(error, request, response, next) {
  const statusCode = error instanceof SyntaxError && error.status === 400
    ? 400
    : error.statusCode ?? 500;
  if (statusCode === 500) {
    console.error(error);
  }
  response.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Error interno del servidor' : error.message,
    ...(error.details ? { details: error.details } : {})
  });
}
