import { describe, expect, it } from 'vitest';
import { optionalText, requiredText, username } from '../src/validate';
import {
  api,
  logAscent,
  publish,
  publishResponse,
  reportResponse,
  signIn,
  signupBody,
} from './helpers';

const rejected = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    return error instanceof Response ? error.status : 'not a response';
  }
  return 'accepted';
};

// Control characters, and the marks and overrides that reorder text on screen.
const HIDDEN = [
  '\u0000',
  '\u0007',
  '\u001b',
  '\n',
  '\u007f',
  '\u0085',
  '‎',
  '‏',
  '‪',
  '‫',
  '‬',
  '‭',
  '‮',
  '⁦',
  '⁧',
  '⁨',
  '⁩',
];

describe('requiredText', () => {
  it('trims, and counts characters rather than UTF-16 units', () => {
    expect(requiredText('  hello  ', [1, 5], 'bad')).toBe('hello');
    expect(requiredText('😀😀', [2, 2], 'bad')).toBe('😀😀');
    expect(rejected(() => requiredText('😀', [2, 2], 'bad'))).toBe(422);
    expect(rejected(() => requiredText(5, [1, 5], 'bad'))).toBe(422);
    expect(rejected(() => requiredText('   ', [1, 5], 'bad'))).toBe(422);
  });

  it('rejects control and direction-changing characters, wherever they are', () => {
    for (const hidden of HIDDEN) {
      const label = `U+${hidden.codePointAt(0)!.toString(16)}`;
      expect(
        rejected(() => requiredText(`a${hidden}b`, [1, 10], 'bad')),
        label
      ).toBe(422);
    }
  });

  it('accepts what people really write', () => {
    for (const text of ['Zoë Müller', 'Crimpy – V4', '岩場', 'Beta: left, then up!', '👨‍👩‍👧 family']) {
      expect(requiredText(text, [1, 40], 'bad')).toBe(text);
    }
  });
});

describe('optionalText', () => {
  it('is null for missing or blank text and checks the rest like requiredText', () => {
    expect(optionalText(undefined, [1, 5], 'bad')).toBeNull();
    expect(optionalText(null, [1, 5], 'bad')).toBeNull();
    expect(optionalText('   ', [1, 5], 'bad')).toBeNull();
    expect(optionalText(' ok ', [1, 5], 'bad')).toBe('ok');
    expect(rejected(() => optionalText('a‮b', [1, 5], 'bad'))).toBe(422);
    expect(rejected(() => optionalText(5, [1, 5], 'bad'))).toBe(422);
  });
});

describe('username', () => {
  it('allows letters, digits, underscores and hyphens', () => {
    expect(username('Alice_99-x', 'bad')).toBe('Alice_99-x');
    for (const bad of ['no spaces', 'ab', 'x'.repeat(31), 'ünïcode', '']) {
      expect(
        rejected(() => username(bad, 'bad')),
        bad
      ).toBe(422);
    }
  });

  it('refuses reserved names in any case', () => {
    for (const name of ['admin', 'ADMIN', 'Routemaker', 'support', 'root']) {
      expect(
        rejected(() => username(name, 'bad')),
        name
      ).toBe(422);
    }
    expect(username('admins', 'bad')).toBe('admins');
  });
});

// Each place users type free text must go through the same checks.
describe('free text fields', () => {
  const bad = 'x‮y';

  it('refuse hidden characters in names, notes and details', async () => {
    const user = await signIn();
    const route = await publish(user);
    const gym = (extra: object) =>
      api('/gyms', {
        token: user.token,
        json: {
          name: 'Climb Central',
          address: '1 Wall Street',
          country_code: 'SG',
          latitude: 1,
          longitude: 1,
          ...extra,
        },
      });
    const responses: [string, Response][] = [
      [
        'signup display name',
        await api('/auth/signup', { json: { ...signupBody(), display_name: bad } }),
      ],
      [
        'profile display name',
        await api('/me', { method: 'PATCH', token: user.token, json: { display_name: bad } }),
      ],
      ['route name', await publishResponse(user, { name: bad })],
      ['gym name', await gym({ name: bad })],
      ['gym address', await gym({ address: bad })],
      ['note', await logAscent(user, route.id, { sent: true, note: bad })],
      ['report details', await reportResponse(user, 'route', route.id, 'other', bad)],
    ];
    for (const [field, response] of responses) {
      expect(response.status, field).toBe(422);
    }
  });
});
