# Draco Sheets — 100-Version Roadmap

Goal: replicate the complete MS Excel feature set, then add new ideas.
Each version is a shippable slice. Engine: Univer (grid/formulas) + React shell + Supabase + PWA.

## Phase A — Foundation (v1–v10)
- v1 Project scaffold, grid render, cell edit, selection, scroll
- v2 PWA: manifest, icons, service worker, installable
- v3 Responsive shell: desktop ribbon, tablet compact, mobile bottom bar
- v4 Undo/redo, clipboard (cut/copy/paste), paste special
- v5 Row/column insert, delete, hide, resize, autofit
- v6 Multi-sheet tabs: add, rename, delete, reorder, color, hide
- v7 Supabase schema + RLS: workbooks, versions
- v8 Auth (email/password, Google) and per-user workbook list
- v9 Autosave, manual save, open, rename, delete workbook
- v10 New / Open / Save As dialogs, recent files, offline draft cache

## Phase B — Formatting (v11–v25)
- v11 Font family, size, bold, italic, underline, strikethrough
- v12 Font color, fill color, color palette, recent colors
- v13 Alignment (horizontal, vertical), indent
- v14 Wrap text, merge and center, unmerge, center across selection
- v15 Borders (all styles, colors, draw border)
- v16 Number formats: General, Number, Currency, Accounting
- v17 Number formats: Date, Time, Percentage, Fraction, Scientific, Text
- v18 Custom number formats editor
- v19 Format Painter
- v20 Cell styles and themes
- v21 Text rotation and orientation
- v22 Shrink to fit, text overflow rules
- v23 Conditional formatting: highlight rules
- v24 Conditional formatting: data bars, color scales, icon sets
- v25 Conditional formatting: custom formula, manage rules

## Phase C — Formulas core (v26–v45)
- v26 Formula bar, name box, formula editing, F2/F4 modes
- v27 Math and trig functions
- v28 Statistical functions
- v29 Logical functions (IF, IFS, AND, OR, SWITCH, XOR)
- v30 Text functions
- v31 Date and time functions
- v32 Lookup: VLOOKUP, HLOOKUP, INDEX, MATCH
- v33 Lookup: XLOOKUP, XMATCH, LOOKUP
- v34 Financial functions
- v35 Information and error-handling functions (IFERROR, ISxxx)
- v36 Engineering and conversion functions
- v37 Database functions (DSUM, DCOUNT…)
- v38 Dynamic arrays: FILTER, SORT, SORTBY, UNIQUE, SEQUENCE
- v39 Dynamic arrays: LET, LAMBDA, MAP, REDUCE, SCAN, BYROW
- v40 Array formulas, spill ranges, implicit intersection
- v41 Named ranges and Name Manager
- v42 Absolute/relative refs, cross-sheet refs, 3D refs
- v43 Formula auditing: trace precedents/dependents, show formulas
- v44 Error checking, evaluate formula, watch window
- v45 Calculation options (auto/manual), iterative calc, circular refs

## Phase D — Data tools (v46–v60)
- v46 Sort (single, multi-level, custom lists)
- v47 AutoFilter, text/number/date filters
- v48 Advanced filter, slicer-style quick filters
- v49 Find and Replace (formulas, formats, within sheet/workbook)
- v50 Go To, Go To Special
- v51 Data validation: lists, numbers, dates, custom
- v52 Data validation: input messages, error alerts, circle invalid
- v53 Remove duplicates, text to columns, flash fill
- v54 Fill handle: series, autofill, custom series
- v55 Freeze panes, split panes
- v56 Group/outline rows and columns, subtotals
- v57 Tables (structured refs, banded rows, total row)
- v58 Table styles and slicers
- v59 Consolidate, what-if: Goal Seek
- v60 What-if: Data Tables, Scenario Manager, Solver-lite

## Phase E — Charts and visuals (v61–v72)
- v61 Charts: column, bar, line
- v62 Charts: pie, doughnut, area
- v63 Charts: scatter, bubble
- v64 Charts: radar, stock, surface
- v65 Charts: combo, secondary axis
- v66 Charts: waterfall, funnel, histogram, box, treemap, sunburst
- v67 Chart elements: titles, legends, axes, labels, trendlines, error bars
- v68 Chart styles, themes, templates
- v69 Sparklines (line, column, win/loss)
- v70 Images, shapes, text boxes, icons
- v71 SmartArt-style diagrams
- v72 Camera/linked picture, 3D-ish map charts

## Phase F — PivotTables (v73–v78)
- v73 PivotTable: create, row/column/value fields
- v74 PivotTable: grouping (dates, numbers), calculated fields
- v75 PivotTable: filters, slicers, timelines
- v76 PivotTable: show values as, sort, subtotals, layouts
- v77 PivotCharts
- v78 Power-query-lite: import, transform, refresh

## Phase G — Files and interop (v79–v86)
- v79 Import/export .xlsx (values, formulas, styles)
- v80 Import/export .csv, .tsv, .ods, .json
- v81 Export PDF, print layout, page setup
- v82 Print preview, headers/footers, print area, page breaks
- v83 .xlsm-safe handling, legacy .xls import
- v84 Copy/paste from Excel and Google Sheets with formatting
- v85 Version history, restore, compare versions
- v86 Autosave drafts, crash recovery, offline sync queue

## Phase H — Collaboration and review (v87–v92)
- v87 Comments and threaded replies
- v88 Notes
- v89 Real-time co-editing via Supabase Realtime, presence cursors
- v90 Share links, view/comment/edit roles
- v91 Track changes / change log
- v92 Protect sheet/workbook, locked cells, cell permissions

## Phase I — Advanced (v93–v100)
- v93 Macros-lite: record and replay actions
- v94 Scripting: JS automation (Office Scripts style)
- v95 Hyperlinks, document links, external data connections
- v96 Accessibility: keyboard parity, screen reader, high contrast
- v97 Performance: virtualization for 1M rows, workers
- v98 Localization, RTL, regional formats
- v99 Excel keyboard shortcut parity, command search (Alt/Ctrl+/)
- v100 Final parity audit + new features (AI assist, templates gallery, themes)
