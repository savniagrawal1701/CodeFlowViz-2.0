'use client';

import Editor, { type Monaco } from '@monaco-editor/react';
import { useMemo, useState } from 'react';

const starterCode = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const value = 6;
const result = fibonacci(value);
console.log({ value, result });
result;`;

type ExecutionLog = {
  level: string;
  message: string;
};

type ExecutionResponse = {
  ok: boolean;
  result?: { type: string; value: string };
  logs: ExecutionLog[];
  error?: string;
  durationMs: number;
  timedOut: boolean;
};

export default function CodeEditor() {
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState<ExecutionResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const options = useMemo(
    () => ({
      automaticLayout: true,
      fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 14,
      lineHeight: 22,
      minimap: { enabled: false },
      glyphMargin: true,
      lineNumbers: 'on' as const,
      smoothScrolling: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      padding: { top: 16, bottom: 16 },
    }),
    []
  );

  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.editor.defineTheme('void', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'D7E4F8' },
        { token: 'keyword', foreground: '88B4FF' },
        { token: 'number', foreground: 'F4CA64' },
        { token: 'string', foreground: '95D8A6' },
        { token: 'comment', foreground: '6A7D9B' },
      ],
      colors: {
        'editor.background': '#0B1020',
        'editorLineNumber.foreground': '#425176',
        'editorLineNumber.activeForeground': '#8FB5FF',
        'editorCursor.foreground': '#7AB8FF',
        'editor.selectionBackground': '#1B325C99',
        'editor.lineHighlightBackground': '#111A2D',
      },
    });
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput(null);

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, timeoutMs: 1000 }),
      });
      const result = (await response.json()) as ExecutionResponse;
      setOutput(result);
    } catch (error) {
      setOutput({
        ok: false,
        logs: [],
        durationMs: 0,
        timedOut: false,
        error: error instanceof Error ? error.message : 'Unable to reach the execution sandbox.',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="codeRunner">
      <div className="runnerToolbar">
        <button className="primaryAction" type="button" onClick={runCode} disabled={isRunning}>
          {isRunning ? 'Running…' : 'Run in Sandbox'}
        </button>
        <span>JavaScript VM · 1s timeout · isolated worker</span>
      </div>

      <div className="monacoPane">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={code}
          onChange={(value) => setCode(value ?? '')}
          beforeMount={handleEditorWillMount}
          theme="void"
          options={options}
        />
      </div>

      <div className={`outputPane ${output?.ok ? 'success' : output ? 'failure' : ''}`}>
        <div className="outputHeader">
          <span>Sandbox Output</span>
          {output ? <span>{output.durationMs}ms</span> : <span>Idle</span>}
        </div>
        {output ? (
          <div className="outputBody">
            {output.error ? <pre className="errorText">{output.error}</pre> : null}
            {output.result ? <pre>Result ({output.result.type}): {output.result.value}</pre> : null}
            {output.logs.length ? (
              <div className="logList">
                {output.logs.map((log, index) => (
                  <pre key={`${log.level}-${index}`}>[{log.level}] {log.message}</pre>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p>Run code to see console output, return values, errors, and timeout status.</p>
        )}
      </div>
    </div>
  );
}
