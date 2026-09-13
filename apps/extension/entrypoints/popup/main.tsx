import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BRAND, parseModelRef } from '@sayable/core';
import { validateConfig, type SayableConfig } from '@sayable/config';

const CONFIG_KEY = 'sayable.config';

function Popup() {
  const [model, setModel] = useState<string>();
  const [hasKey, setHasKey] = useState(false);
  const [shortcut, setShortcut] = useState<string>();

  useEffect(() => {
    void (async () => {
      const stored = await browser.storage.local.get([CONFIG_KEY, 'sayable.secrets']);
      const parsed = validateConfig(stored[CONFIG_KEY] as SayableConfig | undefined);

      if (parsed.ok && parsed.config.model) {
        const parts = parseModelRef(parsed.config.model);
        setModel(parts ? `${parts.providerId} · ${parts.modelId}` : parsed.config.model);
      }

      const secrets = stored['sayable.secrets'];
      setHasKey(typeof secrets === 'object' && secrets !== null && Object.keys(secrets).length > 0);

      const commands = await browser.commands.getAll();
      const invoke = commands.find((command) => command.name === 'invoke-register-bar');
      setShortcut(invoke?.shortcut || 'unassigned');
    })();
  }, []);

  return (
    <main className="w-72 p-4 text-sm text-neutral-800">
      <h1 className="text-base font-medium">{BRAND.name}</h1>
      <p className="mt-1 text-xs text-neutral-500">{BRAND.tagline}</p>

      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Model</dt>
          <dd>{model ?? 'not configured'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Key</dt>
          <dd>{hasKey ? 'saved' : 'missing'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Shortcut</dt>
          <dd>{shortcut}</dd>
        </div>
      </dl>

      {!hasKey || !model ? (
        <p className="mt-3 text-xs text-neutral-600">
          Add a key or run a local model — takes a minute.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => browser.runtime.openOptionsPage()}
        className="mt-3 w-full rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
      >
        Open settings
      </button>
    </main>
  );
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Popup />);
