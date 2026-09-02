export class AppError extends Error {
  constructor(public code: string, public safeMessage: string, public statusCode: number) { super(safeMessage); }
}
export class UnauthorizedError extends AppError { constructor() { super("UNAUTHORIZED", "Please sign in to continue.", 401); } }
export class ForbiddenError extends AppError { constructor() { super("FORBIDDEN", "You do not have access to this resource.", 403); } }
export class NotFoundError extends AppError { constructor() { super("NOT_FOUND", "The requested resource was not found.", 404); } }
export class ConflictError extends AppError { constructor(message = "This resource already exists.") { super("CONFLICT", message, 409); } }

