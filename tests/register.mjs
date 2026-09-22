// node --import ./tests/register.mjs --test
//
// Hooks the module loader so src/lib files load as ESM and their native
// imports (react-native, AsyncStorage, expo-*) resolve to the in-memory
// stubs in tests/stubs. Nothing in src/ changes for the tests' sake.
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);

// Metro defines this global for every bundle; api.js reads it at load.
globalThis.__DEV__ = true;
