import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "HTTP_ERROR") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function handleRouteError(error: unknown, label: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid input.",
        details: error.flatten(),
      },
      { status: 400 },
    );
  }

  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status },
    );
  }

  if (error instanceof HttpError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error(`${label}:`, message);
  return NextResponse.json({ error: message }, { status: 500 });
}
