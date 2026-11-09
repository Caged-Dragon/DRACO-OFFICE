export { Check, Field, Result } from '../../ui/form';
import { type ReactNode } from 'react';
import { type Out } from '../../data/dataGlue';
import { Manage } from './Manage';

export type Tab = 'spark' | 'shape' | 'icon' | 'diagram' | 'camera' | 'manage';

export const TABS: [Tab, string][] = [
  ['spark', 'Sparklines'],
  ['shape', 'Shapes & text'],
  ['icon', 'Icons'],
  ['diagram', 'Diagrams'],
  ['camera', 'Linked picture'],
  ['manage', 'Manage'],
];

export const Svg = ({ html, label }: { html: string; label: string }) => (
  <div className="obj-preview" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />
);
