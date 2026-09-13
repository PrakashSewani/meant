import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DoctorResultSchema, type DoctorResult } from '@sayable/core';
import {
  PRESETS,
  defaultConfigFor,
  presetFor,
  presetOrigin,
  type ProviderPreset,
} from '@sayable/config';

const CONFIG_KEY = 'sayable.config';
const SECRETS_KEY = 'sayable.secrets';

function Options() {
  const [selected, setSelected] = useState<string>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<string>();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DoctorResult>();

  const preset = presetFor(selected);

  async function testConnection() {
    setTesting(true);
    setTestResult(undefined);

    try {
      const raw = await browser.runtime.sendMessage({ type: 'doctor' });
      const parsed = DoctorResultSchema.safeParse(raw);

      setTestResult(
        parsed.success ? parsed.data : { ok: false, message: 'The worker did not answer.' },
      );
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!preset) return;

    setStatus(undefined);
    await browser.storage.local.set({ [CONFIG_KEY]: defaultConfigFor(preset) });

    if (preset.auth === 'apiKey' && apiKey.trim()) {
      await browser.storage.local.set({ [SECRETS_KEY]: { [preset.id]: apiKey.trim() } });
      setApiKey('');
    }

    const granted = await browser.permissions.request({ origins: [presetOrigin(preset)] });
    setStatus(
      granted
        ? `${preset.name} is enabled.`
        : `${preset.name} is saved, but the permission was declined — calls will fail until you allow it.`,
    );
  }

  return (
    <main className="mx-auto max-w-xl p-8 text-sm text-neutral-800">
      <h1 className="text-lg font-medium">Sayable settings</h1>

      <section className="mt-6">
        <h2 className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Provider</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PRESETS.map((candidate) => (
            <PresetButton
              key={candidate.id}
              preset={candidate}
              selected={candidate.id === selected}
              onSelect={() => {
                setSelected(candidate.id);
                setStatus(undefined);
              }}
            />
          ))}
        </div>

        {preset ? (
          <p className="mt-2 text-xs text-neutral-500">
            {preset.notes} · {preset.transport}
            {preset.local ? ' · nothing leaves this device' : ''}
          </p>
        ) : null}
      </section>

      {preset?.auth === 'apiKey' ? (
        <section className="mt-6">
          <h2 className="text-xs font-medium tracking-wide text-neutral-500 uppercase">API key</h2>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={`${preset.name} key`}
            className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
          />
          <p className="mt-2 text-xs text-neutral-500">
            Stored in this browser profile only. Never synced, never readable by a page.
          </p>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white"
      >
        Save and enable
      </button>

      <button
        type="button"
        onClick={() => void testConnection()}
        disabled={testing}
        className="mt-6 ml-2 rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium disabled:opacity-50"
      >
        {testing ? 'Testing…' : 'Test connection'}
      </button>

      {status ? <p className="mt-3 text-xs text-neutral-600">{status}</p> : null}

      {testResult ? (
        <p className={`mt-2 text-xs ${testResult.ok ? 'text-neutral-600' : 'text-red-700'}`}>
          {testResult.message}
        </p>
      ) : null}
    </main>
  );
}

function PresetButton({
  preset,
  selected,
  onSelect,
}: {
  preset: ProviderPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-md border px-3 py-2 text-left text-xs ${
        selected ? 'border-neutral-900 bg-neutral-50 font-medium' : 'border-neutral-200'
      }`}
    >
      {preset.name}
    </button>
  );
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Options />);
