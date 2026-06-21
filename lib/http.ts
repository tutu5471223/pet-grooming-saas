import { NextResponse } from "next/server"

/** Standard JSON error envelope: { error, code? }. */
export function errorResponse(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}) },
    { status }
  )
}

/** Opaque 500 for unexpected failures — never leak internals to the client. */
export function serverError() {
  return NextResponse.json(
    { error: "操作失敗，請稍後再試", code: "INTERNAL_ERROR" },
    { status: 500 }
  )
}
