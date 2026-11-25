import { useEffect, useState } from "react";
export function useLeft(left: number, key: unknown) {
  const [l, setL] = useState(left);
  useEffect(() => {
    const t = Date.now(); setL(left);
    const h = setInterval(() => setL(Math.max(0, left - (Date.now() - t))), 200);
    return () => clearInterval(h);
  }, [left, key]);
  return Math.ceil(l / 1000);
}
