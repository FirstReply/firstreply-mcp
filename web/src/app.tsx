/**
 * What every widget shares: the connection to the host (MCP Apps), the tool result it renders,
 * and small hooks over both. A widget is `mount(<Component />)` in its own entry file.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyDocumentTheme, useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/client';
import './styles.css';

interface Connection {
  app: App | null;
  result: CallToolResult | null;
  input: Record<string, unknown> | null;
  host: McpUiHostContext | undefined;
  cancelled: boolean;
}

const ConnectionContext = createContext<Connection>({ app: null, result: null, input: null, host: undefined, cancelled: false });

function Provider({ name, children }: { name: string; children: ReactNode }) {
  const [result, setResult] = useState<CallToolResult | null>(null);
  const [input, setInput] = useState<Record<string, unknown> | null>(null);
  const [host, setHost] = useState<McpUiHostContext | undefined>(undefined);
  const [cancelled, setCancelled] = useState(false);
  // The callbacks are registered once on the App; the setters are stable
  const setters = useRef({ setResult, setInput, setHost, setCancelled });

  const onAppCreated = useCallback((app: App) => {
    app.ontoolresult = (params) => {
      setters.current.setCancelled(false);
      setters.current.setResult(params);
    };
    app.ontoolinput = (params) => setters.current.setInput((params.arguments as Record<string, unknown>) ?? null);
    app.ontoolcancelled = () => setters.current.setCancelled(true);
    app.onhostcontextchanged = (params) => setters.current.setHost((previous) => ({ ...previous, ...params }));
    app.onteardown = async () => ({});
  }, []);

  const { app, isConnected } = useApp({
    appInfo: { name, version: '1.0.0' },
    capabilities: {},
    onAppCreated,
  });

  useHostStyles(app, host ?? app?.getHostContext());

  // A host that sends no theme: follow the system, as the light-dark() tokens already do
  const hostTheme = host?.theme ?? app?.getHostContext()?.theme;
  useEffect(() => {
    if (!app || hostTheme || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => applyDocumentTheme(query.matches ? 'dark' : 'light');
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [app, hostTheme]);

  useEffect(() => {
    const context = isConnected ? app?.getHostContext() : undefined;
    if (context) setHost((previous) => ({ ...context, ...previous }));
  }, [isConnected, app]);

  return <ConnectionContext.Provider value={{ app, result, input, host, cancelled }}>{children}</ConnectionContext.Provider>;
}

export function mount(name: string, widget: ReactNode): void {
  createRoot(document.getElementById('root')!).render(<Provider name={name}>{widget}</Provider>);
}

/** The text of a tool result: what a failed call says. */
export function resultText(result: CallToolResult | null | undefined): string {
  return (result?.content ?? [])
    .map((block) => (block.type === 'text' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

export type ToolState<T> = { state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready'; data: T };

/** The widget's data once the tool finished, or why there is none. */
export function useToolData<T>(): ToolState<T> {
  const { result, cancelled } = useContext(ConnectionContext);
  if (!result) {
    return cancelled ? { state: 'failed', message: '' } : { state: 'loading' };
  }
  if (result.isError || !result.structuredContent) {
    return { state: 'failed', message: result.isError ? resultText(result) : '' };
  }
  return { state: 'ready', data: result.structuredContent as T };
}

export function useLocale(): string {
  const { host } = useContext(ConnectionContext);
  return host?.locale || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en';
}

export function useTimeZone(): string | undefined {
  return useContext(ConnectionContext).host?.timeZone;
}

/** Calls a tool of this server, when the host lets widgets do that. */
export function useCallTool(): ((name: string, args: Record<string, unknown>) => Promise<CallToolResult>) | null {
  const { app } = useContext(ConnectionContext);
  const call = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      const result = await app!.callServerTool({ name, arguments: args });
      if (result.isError) throw new Error(resultText(result) || `${name} failed`);
      return result;
    },
    [app],
  );
  return app?.getHostCapabilities()?.serverTools ? call : null;
}

/** Tells the model what the user did in the widget, for hosts that take such updates. */
export function useTellModel(): (text: string) => Promise<void> {
  const { app } = useContext(ConnectionContext);
  return useCallback(
    async (text: string) => {
      if (!app?.getHostCapabilities()?.updateModelContext) return;
      try {
        await app.updateModelContext({ content: [{ type: 'text', text }] });
      } catch (error) {
        console.error('[updateModelContext]', error);
      }
    },
    [app],
  );
}

export function useOpenLink(): (url: string) => Promise<void> {
  const { app } = useContext(ConnectionContext);
  return useCallback(
    async (url: string) => {
      if (app?.getHostCapabilities()?.openLinks) {
        try {
          const result = await app.openLink({ url });
          if (!result?.isError) return;
        } catch (error) {
          console.error('[openLink]', error);
        }
      }
      window.open(url, '_blank', 'noopener');
    },
    [app],
  );
}
