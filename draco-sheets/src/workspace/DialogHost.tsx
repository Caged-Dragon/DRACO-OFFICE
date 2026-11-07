import type { Session } from '@supabase/supabase-js';
import type { Engine } from '../engine';
import type { WorkbookMeta } from '../store';
import FilesDialog from '../files/FilesDialog';
import CollabDialog, { type CollabTab } from '../collab/CollabDialog';
import AuthDialog from '../AuthDialog';
import OpenDialog from '../OpenDialog';
import RoadmapDialog from '../RoadmapDialog';
import CellStylesDialog from '../CellStylesDialog';
import FormulasDialog from '../FormulasDialog';
import DataDialog from '../DataDialog';
import ChartDialog from '../charts/ChartDialog';
import ObjectsDialog from '../objects/ObjectsDialog';
import PivotDialog from '../pivot/PivotDialog';
import QueryDialog from '../query/QueryDialog';
import ToolsDialog, { type ToolsTab } from '../tools/ToolsDialog';
import type { DialogId } from './TopBar';

type FilesCtx = React.ComponentProps<typeof FilesDialog>['ctx'];
export interface DialogHostProps {
  dialog: DialogId; setDialog: (d: DialogId) => void; engine: Engine | null; session: Session | null; rtab: CollabTab; ttab: ToolsTab; title: string;
  getSnapshot: () => Record<string, unknown> | null; openMeta: (m: WorkbookMeta) => void | Promise<void>; openTemplate: (id: string) => void;
  cur: { id: string; title: string; cloud: boolean }; onImportNew: NonNullable<FilesCtx['onImport']>; onRestore: (snap: unknown) => void; scheduleSave: () => void; markCheckpoint: (hash: string) => void;
}
/** Renders whichever dialog is open. One place decides which dialog gets which props. */
export default function DialogHost({ dialog, setDialog, engine, session, rtab, ttab, title, getSnapshot, openMeta, openTemplate, cur, onImportNew, onRestore, scheduleSave, markCheckpoint }: DialogHostProps) {
  return (
    <>
  {dialog === 'open' && <OpenDialog signedIn={Boolean(session)} onOpen={(m: WorkbookMeta) => void openMeta(m)} onClose={() => setDialog(null)} />}
  {dialog === 'review' && engine && <CollabDialog tab={rtab} title={title} getSnapshot={() => getSnapshot()} onClose={() => setDialog(null)} />}
  {dialog === 'auth' && <AuthDialog session={session} onClose={() => setDialog(null)} />}
  {dialog === 'tools' && engine && <ToolsDialog engine={engine} tab={ttab} openTemplate={openTemplate} onRoadmap={() => setDialog('roadmap')} onClose={() => setDialog(null)} />}
  {dialog === 'roadmap' && <RoadmapDialog onClose={() => setDialog(null)} />}
  {dialog === 'data' && engine && <DataDialog engine={engine} onClose={() => setDialog(null)} />}
  {dialog === 'pivot' && engine && <PivotDialog engine={engine} onClose={() => setDialog(null)} />}
  {(dialog === 'files' || dialog === 'print') && engine && <FilesDialog engine={engine} tab={dialog === 'print' ? 'print' : 'files'} onClose={() => setDialog(null)} ctx={{ id: cur.id, title: cur.title, getSnapshot: () => getSnapshot() as never, onImport: (imp) => void onImportNew(imp), onRestore: (snap) => { onRestore(snap); }, onSetupChanged: scheduleSave, markCheckpoint }} />}
  {dialog === 'query' && engine && <QueryDialog engine={engine} onClose={() => setDialog(null)} />}
  {dialog === 'objects' && engine && <ObjectsDialog engine={engine} onClose={() => setDialog(null)} />}
  {dialog === 'charts' && engine && <ChartDialog engine={engine} onClose={() => setDialog(null)} />}
  {dialog === 'formulas' && engine && <FormulasDialog engine={engine} onClose={() => setDialog(null)} />}
  {dialog === 'styles' && <CellStylesDialog engine={engine} onClose={() => setDialog(null)} />}
    </>
  );
}
