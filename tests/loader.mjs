import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = pathToFileURL(path.join(root, 'src') + path.sep).href;

// Native modules → stubs. Anything not listed here that a tested module
// imports will fail loudly, which is the point: add a stub, not a mock.
const STUBS = {
  'react-native': 'react-native.mjs',
  '@react-native-async-storage/async-storage': 'async-storage.mjs',
  'expo-constants': 'expo-constants.mjs',
  'expo-document-picker': 'empty.mjs',
  'expo-file-system': 'empty.mjs',
  'expo-image-manipulator': 'empty.mjs',
  'expo-sharing': 'empty.mjs',
  'expo-haptics': 'empty.mjs',
  'react-native-url-polyfill/auto': 'empty.mjs',
  '@supabase/supabase-js': 'supabase.mjs',
};

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) {
    return { url: pathToFileURL(path.join(here, 'stubs', STUBS[specifier])).href, shortCircuit: true };
  }
  // src files import './storage' with no extension; Node ESM wants one.
  if (context.parentURL?.startsWith(src) && specifier.startsWith('.') && !path.extname(specifier)) {
    const target = fileURLToPath(new URL(specifier, context.parentURL));
    if (existsSync(target + '.js')) return { url: pathToFileURL(target + '.js').href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith(src) && url.endsWith('.js')) {
    return { format: 'module', source: await readFile(fileURLToPath(url), 'utf8'), shortCircuit: true };
  }
  return next(url, context);
}
