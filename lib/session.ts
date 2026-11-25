// Stálý anonymní token prohlížeče: podle něj server pozná hráče/hosta i po obnovení stránky nebo výpadku spojení.
export const tok = (key: string) => {
  let t = localStorage.getItem(key);
  if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(key, t); }
  return t;
};
