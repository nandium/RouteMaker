/** What a keyboard can reach: tab stops and the controls that are one by default. */
const FOCUSABLE =
  '[tabindex]:not([tabindex="-1"]), a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
const MODAL = '[role="dialog"][aria-modal="true"]';

type OpenModal = {
  dialog: HTMLElement;
  /** What had focus before the dialog opened, to give it back. */
  opener: HTMLElement | null;
  /** Everything made inert while the dialog is open. */
  inerted: Element[];
};

const focusablesIn = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => !node.closest('[inert]'));

/**
 * The app's sheets are dialogs (`role="dialog" aria-modal="true"`), which a browser does not
 * treat as modal by itself. While one is open in `root`, this keeps keyboards and screen readers
 * inside it: everything else is inert, focus moves in and wraps within it, Escape calls `close`,
 * and when the dialog goes, focus returns to where it was.
 */
export function manageModalFocus(root: ShadowRoot, close: () => void) {
  let modal: OpenModal | null = null;

  /** Make every sibling along the path from the dialog up to the root inert, bar decoration. */
  function inertAround(dialog: HTMLElement) {
    const inerted: Element[] = [];
    let node: Element = dialog;
    while (node.parentNode) {
      const parent: ParentNode = node.parentNode;
      for (const sibling of parent.children) {
        // The scrim is aria-hidden: it is not a control, and a tap on it must still close the sheet.
        if (sibling === node || sibling.getAttribute('aria-hidden') === 'true') continue;
        if (sibling.hasAttribute('inert')) continue;
        sibling.setAttribute('inert', '');
        inerted.push(sibling);
      }
      if (parent === root) break;
      node = parent as Element;
    }
    return inerted;
  }

  function open(dialog: HTMLElement) {
    const active = root.activeElement;
    modal = {
      dialog,
      opener: active instanceof HTMLElement ? active : null,
      inerted: inertAround(dialog),
    };
    if (!focusablesIn(dialog).length) dialog.tabIndex = -1;
    (focusablesIn(dialog)[0] ?? dialog).focus();
  }

  function release() {
    if (!modal) return;
    for (const node of modal.inerted) node.removeAttribute('inert');
    if (modal.opener?.isConnected) modal.opener.focus();
    modal = null;
  }

  new MutationObserver(() => {
    const dialog = root.querySelector<HTMLElement>(MODAL);
    if (dialog === (modal?.dialog ?? null)) return;
    release();
    if (dialog) open(dialog);
  }).observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['role', 'aria-modal'],
  });

  root.addEventListener('keydown', (event) => {
    if (!modal) return;
    const { key, shiftKey } = event as KeyboardEvent;
    if (key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (key !== 'Tab') return;
    const items = focusablesIn(modal.dialog);
    const active = root.activeElement;
    const inside = active instanceof HTMLElement && modal.dialog.contains(active);
    const edge = shiftKey ? items[0] : items.at(-1);
    // Tab off either end, or from outside the dialog, wraps round.
    if (!items.length || !inside || active === edge) {
      event.preventDefault();
      (shiftKey ? items.at(-1) : items[0])?.focus();
    }
  });
}
