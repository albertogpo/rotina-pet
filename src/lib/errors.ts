type ErrorShape = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

type AppErrorInput = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
};

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function errorShape(error: unknown): ErrorShape {
  return error && typeof error === "object" ? (error as ErrorShape) : {};
}

export class AppError extends Error {
  readonly details?: string;
  readonly hint?: string;
  readonly code?: string;

  constructor({ message, details, hint, code }: AppErrorInput) {
    super(message);
    this.name = "AppError";
    this.details = details;
    this.hint = hint;
    this.code = code;
  }
}

export function toAppError(error: unknown, fallback = "Não foi possível concluir a operação."): AppError {
  if (error instanceof AppError) return error;

  const shape = errorShape(error);
  const details = cleanText(shape.details);
  const hint = cleanText(shape.hint);
  const code = cleanText(shape.code);
  const message =
    (error instanceof Error ? cleanText(error.message) : undefined) ??
    (typeof error === "string" ? cleanText(error) : undefined) ??
    cleanText(shape.message) ??
    details ??
    hint ??
    code ??
    fallback;

  return new AppError({ message, details, hint, code });
}

export function appErrorText(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  const normalized = toAppError(error, fallback);
  return [normalized.message, normalized.details, normalized.hint, normalized.code]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

export function appErrorIncludes(error: unknown, expected: string): boolean {
  return appErrorText(error).includes(expected);
}
