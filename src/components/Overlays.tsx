import { useEffect, useRef } from 'react';

import { closeDialog, useStore } from '@/store/store';
import { C, Txt } from './Txt';

/** Onay pencereleri (mobildeki Alert.alert yerine) ve kısa bildirimler. */
export function Overlays() {
  const dialog = useStore((s) => s.dialog);
  const toast = useStore((s) => s.toast);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dialog) confirmRef.current?.focus();
  }, [dialog]);

  return (
    <>
      {dialog && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeDialog()}>
          <div className="dialog" role="alertdialog" aria-modal aria-label={dialog.title}>
            <Txt variant="display" size={24}>
              {dialog.title}
            </Txt>
            <Txt size={15} color={C.textMuted}>
              {dialog.message}
            </Txt>
            <div className="dialog-actions">
              {dialog.onConfirm && (
                <button type="button" className="press card" onClick={closeDialog}>
                  <Txt variant="bold" size={16}>
                    Vazgeç
                  </Txt>
                </button>
              )}
              <button
                ref={confirmRef}
                type="button"
                className="press"
                style={{ background: dialog.danger ? C.danger : C.accent }}
                onClick={() => {
                  closeDialog();
                  dialog.onConfirm?.();
                }}
              >
                <Txt variant="bold" size={16} color={dialog.danger ? C.bg : C.onAccent}>
                  {dialog.confirm ?? 'Tamam'}
                </Txt>
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Txt variant="bold" size={15} color={C.onAccent}>
            {toast}
          </Txt>
        </div>
      )}
    </>
  );
}
