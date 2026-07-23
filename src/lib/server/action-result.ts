export interface ActionError {
  code: string;
  message: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
}

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ActionError };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFailure(
  code: string,
  message: string,
  fieldErrors?: Readonly<Record<string, readonly string[]>>,
): ActionResult<never> {
  return fieldErrors
    ? { ok: false, error: { code, message, fieldErrors } }
    : { ok: false, error: { code, message } };
}
