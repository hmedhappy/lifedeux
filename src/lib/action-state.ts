export type ActionState =
  | {
      error?: string;
      success?: string;
      vars?: Record<string, string | number>;
      detail?: string;
      nonce?: string;
    }
  | undefined;

export function fail(error: string, vars?: Record<string, string | number>): ActionState {
  return { error, vars };
}

export function ok(success: string, extra?: { vars?: Record<string, string | number>; detail?: string }): ActionState {
  return { success, ...extra, nonce: String(Date.now()) };
}
