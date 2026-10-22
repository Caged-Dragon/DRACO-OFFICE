// Runs spreadsheet formula calculation off the main thread so typing/scrolling stay smooth on big sheets.
import { createUniver, LocaleType } from '@univerjs/presets';
import { UniverSheetsCoreWorkerPreset } from '@univerjs/preset-sheets-core/worker';
import { UniverSheetsFilterWorkerPreset } from '@univerjs/preset-sheets-filter/worker';

createUniver({
  locale: LocaleType.EN_US,
  presets: [UniverSheetsCoreWorkerPreset(), UniverSheetsFilterWorkerPreset()],
});
