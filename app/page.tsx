import CodeEditor from '@/components/CodeEditor';

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CodeFlowViz 2.0</p>
          <h1>Execution Cockpit</h1>
        </div>
        <div className="status">Void Theme · Sandbox Ready</div>
      </header>

      <section className="workspace">
        <aside className="panel left">
          <h2>Flow Controls</h2>
          <p>Execute JavaScript in a constrained backend worker with CPU and memory guardrails.</p>
          <button disabled>Step Into</button>
          <button disabled>Step Over</button>
          <button disabled>Reset</button>
        </aside>

        <section className="panel editor">
          <div className="panelTitle">Code Editor</div>
          <div className="editorWrap">
            <CodeEditor />
          </div>
        </section>

        <aside className="panel right">
          <h2>Runtime Introspection</h2>
          <p>Sandbox results, console logs, errors, and timeout status stream back from the execution API.</p>
        </aside>
      </section>
    </main>
  );
}
