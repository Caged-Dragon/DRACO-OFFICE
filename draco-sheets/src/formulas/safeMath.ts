// Math.max/min that survive huge arrays (spreading >~120k values into a call overflows the stack).
export function maxOf(arr: ArrayLike<number>, extra: number[] = []): number {
  let m = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  for (const x of extra) if (x > m) m = x;
  return m;
}
export function minOf(arr: ArrayLike<number>, extra: number[] = []): number {
  let m = Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  for (const x of extra) if (x < m) m = x;
  return m;
}
