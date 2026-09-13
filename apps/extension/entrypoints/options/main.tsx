import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/app.css';
import { DoctorReportSchema, type DoctorReport } from '@meant/core';
import {
  PRESETS,
  customProviderConfig,
  defaultConfigFor,
  isValidProviderId,
  originPatternFor,
  presetFor,
  presetOrigin,
} from '@meant/config';

const CONFIG_KEY = 'meant.config';
const SECRETS_KEY = 'meant.secrets';

interface CustomDraft {
  id: string;
  name: string;
  baseURL: string;
  apiKey: string;
  main: string;
  fast: string;
  reasoning: string;
}

const EMPTY_CUSTOM: CustomDraft = {
  id: '',
  name: '',
  baseURL: '',
  apiKey: '',
  main: '',
  fast: '',
  reasoning: '',
};

/** Anything OpenAI-shaped works: the transport is the same one the presets use. */
function customProblem(draft: CustomDraft): string | undefined {
  if (!isValidProviderId(draft.id)) return 'Give it a short id: lowercase letters, digits, dashes.';
  if (!draft.baseURL.trim()) return 'The base URL is required.';
  if (!URL.canParse(draft.baseURL.trim())) return 'That base URL does not look like a URL.';
  if (!draft.main.trim()) return 'At least one model id is required.';

  return undefined;
}

function Options() {
  const [selected, setSelected] = useState<string>('openrouter');
  const [custom, setCustom] = useState<CustomDraft>(EMPTY_CUSTOM);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<string>();
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<DoctorReport>();

  const preset = selected === 'custom' ? undefined : presetFor(selected);
  const problem = selected === 'custom' ? customProblem(custom) : undefined;

  async function testConnection() {
    setTesting(true);
    setReport(undefined);

    try {
      const raw = await browser.runtime.sendMessage({ type: 'doctor' });
      const parsed = DoctorReportSchema.safeParse(raw);

      setReport(
        parsed.success
          ? parsed.data
          : { ok: false, message: 'The worker did not answer.', checks: [] },
      );
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (selected === 'custom') {
      const blocker = customProblem(custom);
      if (blocker) {
        setStatus(blocker);
        return;
      }

      await saveCustom(custom);
      return;
    }

    if (!preset) return;

    setStatus(undefined);
    await browser.storage.local.set({ [CONFIG_KEY]: defaultConfigFor(preset) });

    if (preset.auth === 'apiKey' && apiKey.trim()) {
      await storeSecret(preset.id, apiKey.trim());
      setApiKey('');
    }

    const granted = await browser.permissions.request({ origins: [presetOrigin(preset)] });
    setStatus(
      granted
        ? `${preset.name} is enabled.`
        : `${preset.name} is saved, but the permission was declined — calls will fail until you allow it.`,
    );

    // Saving is the moment someone finds out whether it works, so ask now instead of making them
    // go find the button.
    await testConnection();
  }

  async function saveCustom(draft: CustomDraft) {
    const id = draft.id.trim();
    const name = draft.name.trim() || id;

    setStatus(undefined);
    await browser.storage.local.set({
      [CONFIG_KEY]: customProviderConfig({
        id,
        name,
        baseURL: draft.baseURL.trim(),
        models: {
          main: draft.main.trim(),
          fast: draft.fast.trim() || undefined,
          reasoning: draft.reasoning.trim() || undefined,
        },
      }),
    });

    if (draft.apiKey.trim()) await storeSecret(id, draft.apiKey.trim());

    // The endpoint is an origin we have never seen, so it is granted here, once, from this click.
    const granted = await browser.permissions.request({
      origins: [originPatternFor(draft.baseURL.trim())],
    });

    setCustom({ ...draft, apiKey: '' });
    setStatus(
      granted
        ? `${name} is enabled.`
        : `${name} is saved, but the permission was declined — calls will fail until you allow it.`,
    );

    await testConnection();
  }

  return (
    <main className="mx-auto max-w-xl p-8 text-sm text-neutral-800">
      <h1 className="text-lg font-medium">Meant settings</h1>

      <section className="mt-6">
        <h2 className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Provider</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PRESETS.map((candidate) => (
            <PresetButton
              key={candidate.id}
              label={candidate.name}
              selected={candidate.id === selected}
              onSelect={() => {
                setSelected(candidate.id);
                setStatus(undefined);
              }}
            />
          ))}
          <PresetButton
            label="Custom (OpenAI-compatible)"
            selected={selected === 'custom'}
            onSelect={() => {
              setSelected('custom');
              setStatus(undefined);
            }}
          />
        </div>

        {preset ? (
          <p className="mt-2 text-xs text-neutral-500">
            {preset.notes} · {preset.transport}
            {preset.local ? ' · nothing leaves this device' : ''}
          </p>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">
            Any endpoint that speaks the OpenAI API: a gateway, a proxy, your own server, or a
            provider that is not listed.
          </p>
        )}
      </section>

      {selected === 'custom' ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Endpoint</h2>
          <Field
            label="Id"
            value={custom.id}
            placeholder="commandcode"
            hint="Used in model references, so keep it short."
            onChange={(id) => setCustom({ ...custom, id })}
          />
          <Field
            label="Name"
            value={custom.name}
            placeholder="Command Code"
            onChange={(name) => setCustom({ ...custom, name })}
          />
          <Field
            label="Base URL"
            value={custom.baseURL}
            placeholder="https://api.example.com/v1"
            onChange={(baseURL) => setCustom({ ...custom, baseURL })}
          />
          <Field
            label="Key"
            value={custom.apiKey}
            placeholder="paste it here"
            secret
            onChange={(apiKey) => setCustom({ ...custom, apiKey })}
          />
          <Field
            label="Model"
            value={custom.main}
            placeholder="gpt-5.2"
            hint="The one Balanced transforms use."
            onChange={(main) => setCustom({ ...custom, main })}
          />
          <Field
            label="Fast model"
            value={custom.fast}
            placeholder="optional"
            onChange={(fast) => setCustom({ ...custom, fast })}
          />
          <Field
            label="Deep model"
            value={custom.reasoning}
            placeholder="optional"
            onChange={(reasoning) => setCustom({ ...custom, reasoning })}
          />
        </section>
      ) : null}

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
        disabled={selected === 'custom' && Boolean(problem)}
        className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
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

      {report ? (
        <section className="mt-3">
          <p className={`text-xs ${report.ok ? 'text-neutral-600' : 'text-neutral-800'}`}>
            {report.message}
          </p>
          <ul className="mt-2 space-y-1">
            {report.checks.map((check) => (
              <li key={check.label} className="flex gap-2 text-xs">
                <span aria-hidden className={check.ok ? 'text-neutral-500' : 'text-red-700'}>
                  {check.ok ? '✓' : '✗'}
                </span>
                <span className="text-neutral-500">{check.label}</span>
                <span className={check.ok ? 'text-neutral-500' : 'text-red-700'}>
                  {check.ok ? '' : check.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

async function storeSecret(providerId: string, apiKey: string): Promise<void> {
  const stored = await browser.storage.local.get(SECRETS_KEY);
  const secrets = (stored[SECRETS_KEY] ?? {}) as Record<string, string>;

  await browser.storage.local.set({ [SECRETS_KEY]: { ...secrets, [providerId]: apiKey } });
}

function Field({
  label,
  value,
  placeholder,
  hint,
  secret,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  secret?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-500">{label}</span>
      <input
        type={secret ? 'password' : 'text'}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
      />
      {hint ? <span className="mt-1 block text-xs text-neutral-400">{hint}</span> : null}
    </label>
  );
}

function PresetButton({
  label,
  selected,
  onSelect,
}: {
  label: string;
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
      {label}
    </button>
  );
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Options />);
