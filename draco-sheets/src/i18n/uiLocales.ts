// Generated: lazy loaders for the interface languages (each language is a separate chunk, cached when first used).
type Pack = Record<string, unknown>;
export const UI_LOADERS: Record<string, () => Promise<Pack[]>> = {
  frFR: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/fr-FR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/fr-FR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/fr-FR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/fr-FR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/fr-FR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/fr-FR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/fr-FR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/fr-FR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/fr-FR').then((m) => m.default as Pack),
    ]),
  esES: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/es-ES').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/es-ES').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/es-ES').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/es-ES').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/es-ES').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/es-ES').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/es-ES').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/es-ES').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/es-ES').then((m) => m.default as Pack),
    ]),
  deDE: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/de-DE').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/de-DE').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/de-DE').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/de-DE').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/de-DE').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/de-DE').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/de-DE').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/de-DE').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/de-DE').then((m) => m.default as Pack),
    ]),
  itIT: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/it-IT').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/it-IT').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/it-IT').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/it-IT').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/it-IT').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/it-IT').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/it-IT').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/it-IT').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/it-IT').then((m) => m.default as Pack),
    ]),
  ptBR: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/pt-BR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/pt-BR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/pt-BR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/pt-BR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/pt-BR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/pt-BR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/pt-BR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/pt-BR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/pt-BR').then((m) => m.default as Pack),
    ]),
  ruRU: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/ru-RU').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/ru-RU').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/ru-RU').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/ru-RU').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/ru-RU').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/ru-RU').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/ru-RU').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/ru-RU').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/ru-RU').then((m) => m.default as Pack),
    ]),
  jaJP: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/ja-JP').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/ja-JP').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/ja-JP').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/ja-JP').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/ja-JP').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/ja-JP').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/ja-JP').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/ja-JP').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/ja-JP').then((m) => m.default as Pack),
    ]),
  zhCN: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/zh-CN').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/zh-CN').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/zh-CN').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/zh-CN').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/zh-CN').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/zh-CN').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/zh-CN').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/zh-CN').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/zh-CN').then((m) => m.default as Pack),
    ]),
  koKR: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/ko-KR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/ko-KR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/ko-KR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/ko-KR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/ko-KR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/ko-KR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/ko-KR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/ko-KR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/ko-KR').then((m) => m.default as Pack),
    ]),
  arSA: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/ar-SA').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/ar-SA').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/ar-SA').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/ar-SA').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/ar-SA').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/ar-SA').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/ar-SA').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/ar-SA').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/ar-SA').then((m) => m.default as Pack),
    ]),
  faIR: () =>
    Promise.all([
      import('@univerjs/preset-sheets-core/locales/fa-IR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-conditional-formatting/locales/fa-IR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-data-validation/locales/fa-IR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-filter/locales/fa-IR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-sort/locales/fa-IR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-find-replace/locales/fa-IR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-hyper-link/locales/fa-IR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-note/locales/fa-IR').then((m) => m.default as Pack),
      import('@univerjs/preset-sheets-drawing/locales/fa-IR').then((m) => m.default as Pack),
    ]),
};
export const UI_RTL = new Set(['arSA', 'faIR']);
