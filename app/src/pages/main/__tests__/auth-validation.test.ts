import { expect, test } from 'vitest';

import { type AuthValues, validateAuth } from '../auth-validation.js';

const values = (overrides: Partial<AuthValues> = {}): AuthValues => ({
  email: 'maya@example.com',
  username: 'maya_t',
  displayName: '',
  password: 'valid-password',
  ...overrides,
});

test('accepts complete credentials for each mode', () => {
  expect(validateAuth('login', values())).toEqual({});
  expect(validateAuth('signup', values())).toEqual({});
  expect(validateAuth('forgot-password', values({ password: '' }))).toEqual({});
});

test('asks for what a sign-in lacks, and ignores what it does not use', () => {
  expect(validateAuth('login', values({ email: ' ', password: '', username: '' }))).toEqual({
    email: 'Enter your email.',
    password: 'Enter your password.',
  });
});

test('asks a password reset only for the email', () => {
  expect(validateAuth('forgot-password', values({ email: '', password: '' }))).toEqual({
    email: 'Enter your email.',
  });
});

test.each([
  ['too short', 'ab'],
  ['too long', 'a'.repeat(31)],
  ['with a space', 'a b c'],
  ['with punctuation', 'maya.t'],
])('rejects a username that is %s', (_why, username) => {
  expect(validateAuth('signup', values({ username }))).toEqual({
    username: 'Use 3–30 letters, numbers, _ or -.',
  });
});

test.each(['maya-t', 'MAYA_T', 'abc', 'a'.repeat(30)])('accepts the username %s', (username) => {
  expect(validateAuth('signup', values({ username }))).toEqual({});
});

test('checks the shape of a new account’s email and the length of its password', () => {
  expect(validateAuth('signup', values({ email: 'maya@', password: 'short' }))).toEqual({
    email: 'Enter a valid email address.',
    password: 'Use at least 8 characters.',
  });
});

test('trims what it checks, as the form trims what it sends', () => {
  expect(
    validateAuth('signup', values({ username: '  maya  ', email: ' maya@example.com ' }))
  ).toEqual({});
});
