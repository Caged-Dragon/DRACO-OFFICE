export const CHART_KEY = 'draco-chart', SPARK_KEY = 'draco-spark', SHAPE_KEY = 'draco-shape', DIAGRAM_KEY = 'draco-diagram', CAMERA_KEY = 'draco-camera', SLICER_KEY = 'draco-slicer', TIMELINE_KEY = 'draco-timeline';
export const ALL_KEYS = [CHART_KEY, SPARK_KEY, SHAPE_KEY, DIAGRAM_KEY, CAMERA_KEY, SLICER_KEY, TIMELINE_KEY] as const;
export type ObjKey = (typeof ALL_KEYS)[number];

export const PIVOTBTN_KEY = 'draco-pivotbtn';
