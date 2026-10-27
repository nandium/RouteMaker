import {
  CLIMBING_GRADES,
  DEFAULT_GRADE,
  MAX_ROUTE_NAME_LENGTH,
} from '../../src/client-contract.js';
import type { Gym } from '../../src/client-contract.js';
import { element, field, gradeTag, selectField, textElement } from '../dom.js';
import { stepHead } from './step.js';

/** What the first step of the form holds. */
export type RouteDetails = { name: string; gymId: string; grade: string };

/** The grades as radio buttons that look like the tags used on route lists. */
function createGradePicker() {
  const group = element('fieldset', 'field grade-picker');
  group.append(textElement('legend', 'Your grade', 'field__label field__label--legend'));
  const tags = element('div', 'grade-group');
  const radios = CLIMBING_GRADES.map((value) => {
    const radio = element('input', 'grade-group__radio');
    radio.type = 'radio';
    radio.name = 'grade';
    radio.value = value;
    const label = element('label', 'grade-group__item');
    label.append(radio, gradeTag(value));
    tags.append(label);
    return radio;
  });
  group.append(
    tags,
    textElement(
      'p',
      'Shown as the public grade until climbers who sent the route suggest their own.',
      'field__hint'
    )
  );
  return {
    element: group,
    radios,
    get value() {
      return radios.find((radio) => radio.checked)?.value ?? DEFAULT_GRADE;
    },
    set value(grade: string) {
      for (const radio of radios) radio.checked = radio.value === grade;
    },
  };
}

/** Step 1: the route's name, gym and grade. */
export function createDetailsForm(gyms: Gym[]) {
  const name = field('Route name', { placeholder: 'e.g. Hush', limit: MAX_ROUTE_NAME_LENGTH });
  const gym = element('select');
  gym.append(...gyms.map((item) => new Option(item.name, item.id)));
  // `?gym=<id>` comes from a gym's own screen; an unknown id keeps the first gym.
  const requested = new URLSearchParams(location.search).get('gym');
  const preselected = gyms.find((item) => item.id === requested);
  if (preselected) gym.value = preselected.id;
  const grade = createGradePicker();
  grade.value = DEFAULT_GRADE;

  const form = element('section', 'step step--details');
  form.append(
    stepHead(1, 'Route details'),
    name.wrapper,
    selectField(
      'Gym',
      gym,
      preselected && `Preselected from ${preselected.name}. Change it if the route is elsewhere.`
    ),
    grade.element
  );
  const controls = [name.input, gym, ...grade.radios];

  return {
    element: form,
    read(): RouteDetails {
      return { name: name.input.value, gymId: gym.value, grade: grade.value };
    },
    /** Fill the form from saved details; a gym the address chose, or one that is gone, stays. */
    write(saved: RouteDetails) {
      name.setValue(saved.name);
      if (!preselected && gyms.some((item) => item.id === saved.gymId)) gym.value = saved.gymId;
      if (CLIMBING_GRADES.includes(saved.grade)) grade.value = saved.grade;
    },
    gymName: () => gyms.find((item) => item.id === gym.value)?.name ?? '',
    focusName: () => name.input.focus(),
    clearName: () => name.setValue(''),
    /** Show `message` under the name field and put the cursor there. */
    rejectName(message: string) {
      name.setError(message);
      name.input.focus();
    },
    setLocked(locked: boolean) {
      for (const control of controls) control.disabled = locked;
    },
    onInput(listener: () => void) {
      for (const control of controls) control.addEventListener('input', listener);
    },
  };
}
