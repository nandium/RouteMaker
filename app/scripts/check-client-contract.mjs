import { readFileSync, readdirSync } from 'node:fs';

import ts from 'typescript';

import { HOST_EVENTS, HOST_MODULES, HOST_PROPS } from '../src/host-contract.ts';

const root = new URL('../', import.meta.url);

function readAll(directory, extension) {
  const base = new URL(`${directory}/`, root);
  return readdirSync(base, { recursive: true })
    .filter((file) => file.endsWith(extension))
    .map((file) => readFileSync(new URL(file, base), 'utf8'))
    .join('\n');
}

// A name counts only as a whole quoted literal or an object key, so "RouteMakerMap" is not
// satisfied by "RouteMakerMapActivity".
const declares = (source, name) =>
  new RegExp(`(["'\`])${name}\\1|(?<![\\w"'\`])${name}\\s*:`).test(source);

/** A native host, read as text: a module method is a Kotlin function or a Swift selector entry. */
function nativeHost(directory, extension, methodPattern) {
  const source = readAll(directory, extension);
  return {
    module: (name) => declares(source, name),
    method: (_module, name) => methodPattern(name).test(source),
    prop: (name) => declares(source, name),
    event: (name) => declares(source, name),
  };
}

/**
 * The browser host, read from the syntax tree of web/lynx-host.ts alone: its module table, the
 * props it sends and the events it dispatches. A mention anywhere else (a parameter type, another
 * file) does not count.
 */
function browserHost() {
  const file = new URL('web/lynx-host.ts', root);
  const tree = ts.createSourceFile(
    file.pathname,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const keys = (object) => object.properties.map((property) => property.name.text);
  const modules = new Map();
  const props = new Set();
  const events = new Set();

  (function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      if (node.name.getText() === 'MODULES') {
        for (const module of node.initializer.properties) {
          modules.set(module.name.text, keys(module.initializer));
        }
      }
      if (node.type?.getText() === 'GlobalProps')
        keys(node.initializer).forEach((key) => props.add(key));
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const [name] = node.arguments;
      if (node.expression.name.text === 'sendGlobalEvent' && name && ts.isStringLiteralLike(name)) {
        events.add(name.text);
      }
    }
    ts.forEachChild(node, visit);
  })(tree);

  return {
    module: (name) => modules.has(name),
    method: (module, name) => modules.get(module)?.includes(name) ?? false,
    prop: (name) => props.has(name),
    event: (name) => events.has(name),
  };
}

const hosts = {
  android: nativeHost('android/app/src/main', '.kt', (name) => new RegExp(`\\bfun ${name}\\(`)),
  ios: nativeHost('ios/RouteMaker', '.swift', (name) => new RegExp(`"${name}"\\s*:`)),
  web: browserHost(),
};
const missing = [];

for (const [module, methods] of Object.entries(HOST_MODULES)) {
  const platforms = new Set(Object.values(methods).flat());
  for (const platform of platforms) {
    if (!hosts[platform].module(module)) missing.push(`${module} (${platform})`);
  }
  for (const [method, platforms] of Object.entries(methods)) {
    for (const platform of platforms) {
      if (!hosts[platform].method(module, method))
        missing.push(`${module}.${method} (${platform})`);
    }
  }
}
for (const [prop, platforms] of Object.entries(HOST_PROPS)) {
  for (const platform of platforms) {
    if (!hosts[platform].prop(prop)) missing.push(`${prop} prop (${platform})`);
  }
}
for (const { name, hosts: platforms } of Object.values(HOST_EVENTS)) {
  for (const platform of platforms) {
    if (!hosts[platform].event(name)) missing.push(`${name} (${platform})`);
  }
}

if (missing.length) {
  throw new Error(`Host sources do not provide: ${missing.join(', ')}.`);
}
