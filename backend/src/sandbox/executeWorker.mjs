import { parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';
import { inspect } from 'node:util';
import { instrumentCode as instrumentJS } from '../tracing/instrument.mjs';
import { instrumentCode as instrumentJava } from '../tracing/javaInstrumenter.mjs';

const MAX_LOGS = 50;
const MAX_LOG_CHARS = 2_000;
const MAX_TRACE_EVENTS = 300;

function clip(value, max = MAX_LOG_CHARS) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function serialize(value) {
  if (typeof value === 'undefined') return { type: 'undefined', value: 'undefined' };
  if (typeof value === 'bigint') return { type: 'bigint', value: `${value.toString()}n` };
  if (typeof value === 'function') return { type: 'function', value: '[Function]' };

  try {
    return {
      type: Array.isArray(value) ? 'array' : typeof value,
      value: clip(inspect(value, { depth: 4, maxArrayLength: 50, breakLength: 100 })),
    };
  } catch {
    return { type: typeof value, value: '[Unserializable value]' };
  }
}

function createTrace(timeline) {
  return Object.freeze({
    capture(line, event, variables = {}) {
      if (timeline.length >= MAX_TRACE_EVENTS) return;
      const snapshot = {};
      for (const [name, value] of Object.entries(variables)) {
        snapshot[name] = serialize(value);
      }
      timeline.push({
        step: timeline.length + 1,
        line,
        event,
        variables: snapshot,
      });
    },
  });
}

function createConsole(logs) {
  const record = (level, args) => {
    if (logs.length >= MAX_LOGS) return;
    logs.push({
      level,
      message: clip(args.map((arg) => serialize(arg).value).join(' ')),
    });
  };

  return Object.freeze({
    log: (...args) => record('log', args),
    info: (...args) => record('info', args),
    warn: (...args) => record('warn', args),
    error: (...args) => record('error', args),
  });
}

function runJavaScript(code, timeoutMs) {
  const logs = [];
  const timeline = [];
  const { code: instrumentedCode, hookCount } = instrumentJS(code);
  const sandbox = Object.create(null);

  Object.defineProperties(sandbox, {
    console: { value: createConsole(logs), enumerable: true },
    __trace: { value: createTrace(timeline), enumerable: false },
    globalThis: { value: sandbox, enumerable: false },
  });

  const context = vm.createContext(sandbox, {
    name: 'codeflowviz-sandbox',
    codeGeneration: { strings: false, wasm: false },
  });

  const script = new vm.Script(`'use strict';\n${instrumentedCode}`, {
    filename: 'user-code.js',
    displayErrors: true,
  });

  const result = script.runInContext(context, {
    timeout: timeoutMs,
    displayErrors: true,
    breakOnSigint: false,
  });

  return { ok: true, result: serialize(result), logs, timeline, instrumentation: { hookCount } };
}

function runJava(code, timeoutMs) {
  const logs = [];
  const timeline = [];
  
  // run the tree-sitter mapper to get the trace hooks in place. We won't actually execute the Java code until we set up a proper compilation and sandboxing environment, but this will allow us to at least get the AST mapping and trace hook counts for now.
  const { code: instrumentedCode, hookCount } = instrumentJava(code);

  // returning a stub for now. TODO: wire up child_process to actually compile and run with javac
  return { 
      ok: true, 
      result: { type: 'string', value: 'Java AST mapped. Compilation sandbox pending.' }, 
      logs, 
      timeline, 
      instrumentation: { hookCount } 
  };
}

function run() {
  const { code, timeoutMs, language } = workerData;
  
  if (language === 'java') {
      return runJava(code, timeoutMs);
  }
  return runJavaScript(code, timeoutMs);
}

try {
  parentPort.postMessage(run());
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : 'Unknown sandbox error',
    logs: [],
    timeline: [],
  });
}
