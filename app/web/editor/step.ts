import { element, textElement } from '../dom.js';

/** The heading of a numbered step of the route form. */
export function stepHead(number: number, title: string) {
  const head = element('div', 'step__head');
  head.append(
    textElement('span', String(number), 'step__number display display--md'),
    textElement('h2', title, 'display display--lg')
  );
  return head;
}
