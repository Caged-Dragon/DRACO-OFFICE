export const ARROWS_KEY = 'draco-arrows';
interface Data { svg: string; width: number; height: number }
/** Float-DOM overlay that draws trace arrows; it never intercepts the mouse. */
export default function ArrowsView(p: { data?: Data }) {
  const d = p.data; if (!d) return null;
  return <svg role="img" aria-label="Formula trace arrows" width={d.width} height={d.height} style={{ pointerEvents: 'none', overflow: 'visible', display: 'block' }} dangerouslySetInnerHTML={{ __html: d.svg }} />;
}
