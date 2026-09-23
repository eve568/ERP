export function sendSuccess(response, data, message = 'Operación realizada correctamente', statusCode = 200) {
  return response.status(statusCode).json({
    success: true,
    data,
    message
  });
}