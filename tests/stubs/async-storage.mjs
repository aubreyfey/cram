// In-memory AsyncStorage. `reset()` between tests.
const mem = new Map();
const AsyncStorage = {
  getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: async (k, v) => void mem.set(k, String(v)),
  removeItem: async (k) => void mem.delete(k),
  multiSet: async (pairs) => pairs.forEach(([k, v]) => mem.set(k, String(v))),
  getAllKeys: async () => [...mem.keys()],
};
export default AsyncStorage;
export const reset = () => mem.clear();
export const dump = () => Object.fromEntries(mem);
