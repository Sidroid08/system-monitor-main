export function errorHandler(err, req, res, next) {
  console.error(err);

  const message = err.message || "Internal server error";

  const status =
    message === "Invalid email or password"
      ? 401
      : message === "User account is inactive"
      ? 403
      : 500;

  return res.status(status).json({
    message,
  });
}