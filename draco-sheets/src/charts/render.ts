// Public chart-renderer API — implementation lives in ./renderer (one file per chart type).
export * from './renderer/types';
export { renderChart } from './renderer';
export { specFromGrid } from './renderer/specFromGrid';
