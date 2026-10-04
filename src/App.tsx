import { TopBar, StatusBar } from './components/TopBar';
import { FileExplorer } from './components/FileExplorer';
import { ThreeAreas } from './components/ThreeAreas';
import { CommitGraph } from './components/CommitGraph';
import { Terminal } from './components/Terminal';
import { RightPanel } from './components/RightPanel';
import { ConflictPanel } from './components/ConflictPanel';

export default function App() {
  return (
    <div className="flex h-full min-w-[1180px] flex-col" style={{ background: 'var(--color-bg)' }}>
      <TopBar />
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_340px]">
        <FileExplorer />
        <main className="flex min-h-0 flex-col" style={{ borderLeft: '1.5px solid var(--color-hairline)', borderRight: '1.5px solid var(--color-hairline)' }}>
          <ThreeAreas />
          <CommitGraph />
        </main>
        <RightPanel />
      </div>
      <Terminal />
      <StatusBar />
      <ConflictPanel />
    </div>
  );
}
