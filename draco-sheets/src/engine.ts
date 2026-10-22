import { createUniver, LocaleType, mergeLocales, CommandType } from '@univerjs/presets';
import type { FUniver } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsConditionalFormattingPreset } from '@univerjs/preset-sheets-conditional-formatting';
import sheetsCFEnUS from '@univerjs/preset-sheets-conditional-formatting/locales/en-US';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import sheetsDVEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import sheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import sheetsSortEnUS from '@univerjs/preset-sheets-sort/locales/en-US';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import sheetsFindEnUS from '@univerjs/preset-sheets-find-replace/locales/en-US';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import sheetsLinkEnUS from '@univerjs/preset-sheets-hyper-link/locales/en-US';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import sheetsNoteEnUS from '@univerjs/preset-sheets-note/locales/en-US';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import sheetsDrawingEnUS from '@univerjs/preset-sheets-drawing/locales/en-US';

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-conditional-formatting/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import '@univerjs/preset-sheets-filter/lib/index.css';
import '@univerjs/preset-sheets-sort/lib/index.css';
import '@univerjs/preset-sheets-find-replace/lib/index.css';
import '@univerjs/preset-sheets-hyper-link/lib/index.css';
import '@univerjs/preset-sheets-note/lib/index.css';
import '@univerjs/preset-sheets-drawing/lib/index.css';

export type RibbonMode = 'classic' | 'simple' | 'collapsed';

export function ribbonForWidth(w: number): RibbonMode {
  if (w >= 1100) return 'classic';
  if (w >= 700) return 'simple';
  return 'collapsed';
}

export interface Engine {
  api: FUniver;
  dispose: () => void;
}

export function bootEngine(container: HTMLElement, onMutation: () => void): Engine {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(
        sheetsCoreEnUS,
        sheetsCFEnUS,
        sheetsDVEnUS,
        sheetsFilterEnUS,
        sheetsSortEnUS,
        sheetsFindEnUS,
        sheetsLinkEnUS,
        sheetsNoteEnUS,
        sheetsDrawingEnUS,
      ),
    },
    presets: [
      UniverSheetsCorePreset({
        container,
        ribbonType: ribbonForWidth(window.innerWidth),
        formulaBar: true,
        workerURL: new Worker(new URL('./formula.worker.ts', import.meta.url), { type: 'module' }),
      }),
      UniverSheetsConditionalFormattingPreset(),
      UniverSheetsDataValidationPreset(),
      UniverSheetsFilterPreset(),
      UniverSheetsSortPreset(),
      UniverSheetsFindReplacePreset(),
      UniverSheetsHyperLinkPreset(),
      UniverSheetsNotePreset(),
      UniverSheetsDrawingPreset(),
    ],
  });

  const sub = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (e) => {
    if (e.type === CommandType.MUTATION) onMutation();
  });

  const onResize = () => univerAPI.setRibbonType(ribbonForWidth(window.innerWidth));
  window.addEventListener('resize', onResize);

  return {
    api: univerAPI,
    dispose: () => {
      window.removeEventListener('resize', onResize);
      sub.dispose();
      univer.dispose();
    },
  };
}
