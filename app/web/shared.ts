export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = ''
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export function field(label: string, type = 'text') {
  const wrapper = element('label', 'tool-field');
  wrapper.append(element('span', '', label));
  const input = element('input');
  input.type = type;
  input.setAttribute('aria-label', label);
  input.placeholder = label;
  wrapper.append(input);
  return { wrapper, input };
}

export function setStatus(node: HTMLElement, message: string, failed = false) {
  node.textContent = message;
  node.className = failed ? 'tool-status tool-status--error' : 'tool-status';
  node.setAttribute('role', failed ? 'alert' : 'status');
  node.setAttribute('aria-live', failed ? 'assertive' : 'polite');
}
