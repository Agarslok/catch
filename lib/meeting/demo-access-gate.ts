/** Contraseña demo: moderador en monitor HTML y modo asincrónico (/async). Solo cliente; no es auth de servidor. */
export const PRESENTER_ACCESS_STORAGE_KEY = "catch:presenter-access:v1";
/** @deprecated use PRESENTER_ACCESS_STORAGE_KEY */
export const DEMO_ACCESS_STORAGE_KEY = PRESENTER_ACCESS_STORAGE_KEY;
export const PRESENTER_ACCESS_PASSWORD = "12345";
/** @deprecated use PRESENTER_ACCESS_PASSWORD */
export const DEMO_ACCESS_PASSWORD = PRESENTER_ACCESS_PASSWORD;

export function verifyPresenterAccessPassword(input: string): boolean {
  return String(input ?? "").trim() === PRESENTER_ACCESS_PASSWORD;
}

/** @deprecated use verifyPresenterAccessPassword */
export const verifyDemoAccessPassword = verifyPresenterAccessPassword;

export function isPresenterAccessGranted(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(PRESENTER_ACCESS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** @deprecated use isPresenterAccessGranted */
export const isDemoAccessGranted = isPresenterAccessGranted;

export function grantPresenterAccess(): void {
  try {
    sessionStorage.setItem(PRESENTER_ACCESS_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** @deprecated use grantPresenterAccess */
export const grantDemoAccess = grantPresenterAccess;
