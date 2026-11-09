import { useEffect, useState } from 'react';
import { renderChart, type ChartSpec } from './render';

interface Layout {
  width: number;
  height: number;
}
interface Props {
  data?: { spec: ChartSpec };
  hostFloatDomLayout$?: { subscribe: (f: (l: Layout) => void) => { unsubscribe: () => void }; getValue?: () => Layout };
}

/** React component the engine mounts for each chart float-dom; re-renders at its true pixel size. */
export function ChartView(props: Props) {
  const [size, setSize] = useState<Layout>(
    () => props.hostFloatDomLayout$?.getValue?.() ?? { width: 480, height: 300 },
  );
  useEffect(() => {
    const s = props.hostFloatDomLayout$?.subscribe((l) => {
      if (l && l.width > 0 && l.height > 0) setSize({ width: l.width, height: l.height });
    });
    return () => s?.unsubscribe();
  }, [props.hostFloatDomLayout$]);
  const spec = props.data?.spec;
  if (!spec) return null;
  return (
    <div
      className="draco-chart"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 4,
        boxShadow: '0 0 0 1px rgba(0,0,0,.12)',
      }}
      dangerouslySetInnerHTML={{
        __html: renderChart(spec, Math.max(120, Math.round(size.width)), Math.max(90, Math.round(size.height))),
      }}
    />
  );
}
