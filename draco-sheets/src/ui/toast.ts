/** Tiny app-wide notifier: `toast('Saved')` from anywhere; <Toaster /> renders it. */
export type ToastKind = 'ok' | 'error' | 'info';
export interface ToastDetail {
  msg: string;
  kind: ToastKind;
}
export const TOAST_EVENT = 'draco-toast';
export const toast = (msg: string, kind: ToastKind = 'info'): void => {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { msg, kind } }));
};
export const toastOut = (r: { ok: boolean; message: string }): void => toast(r.message, r.ok ? 'ok' : 'error');
