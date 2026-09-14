import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import type { ConfigEntry, MeantConfig, StoredConfigEntry } from '@meant/config';
import { CARD, FIELD, GHOST, PRIMARY, RING } from '../styles';

const TRANSPORTS = [
  { id: '@ai-sdk/anthropic', label: 'Anthropic (Messages API)' },
  { id: '@ai-sdk/openai-compatible', label: 'OpenAI-compatible' },
] as const;

export interface PresetChoice {
  id: string;
  name: string;
  notes: string;
  transport: string;
  local: boolean;
}

/** What the add dialog collects. Turning it into a config is the app's job, as is the key. */
export interface NewConfigDraft {
  presetId?: string;
  name: string;
  baseURL?: string;
  model?: string;
  apiKey?: string;
}

export interface ConfigMenuProps {
  entries: readonly ConfigEntry[];
  activeId?: string;
  presets: readonly PresetChoice[];
  hasKey: (providerId: string) => boolean;
  busy?: boolean;
  note?: string;
  onActivate: (id: string) => void;
  onSave: (id: string, entry: StoredConfigEntry) => void;
  onDelete: (id: string) => void;
  onCreate: (draft: NewConfigDraft) => void;
  onReplaceKey: (providerId: string, apiKey: string) => void;
  onRemoveKey: (providerId: string) => void;
  onTest: () => void;
}

export function ConfigMenu({
  entries,
  activeId,
  presets,
  hasKey,
  busy,
  note,
  onActivate,
  onSave,
  onDelete,
  onCreate,
  onReplaceKey,
  onRemoveKey,
  onTest,
}: ConfigMenuProps) {
  const [viewing, setViewing] = useState<string | undefined>(activeId);
  const selected = entries.find((entry) => entry.id === viewing) ?? entries[0];

  if (entries.length === 0) {
    return (
      <section className={`${CARD} p-5 shadow-sm`}>
        <h2 className={HEADING}>Configs</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Nothing saved yet. Add a provider to give it a key and pick the model each Effort uses.
        </p>
        <div className="mt-3">
          <AddConfigDialog presets={presets} onCreate={onCreate} />
        </div>
      </section>
    );
  }

  return (
    <section className={`${CARD} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={HEADING}>Configs</h2>
          <p className="mt-1 text-xs text-neutral-500">
            One is live at a time. Keys are shared per provider, so switching never loses one.
          </p>
        </div>
        <AddConfigDialog presets={presets} onCreate={onCreate} />
      </div>

      <Tabs.Root
        value={selected?.id}
        onValueChange={setViewing}
        className="mt-3"
        activationMode="manual"
      >
        <Tabs.List className="flex flex-wrap items-center gap-1 border-b border-neutral-200">
          {entries.map((entry) => (
            <Tabs.Trigger
              key={entry.id}
              value={entry.id}
              className={`-mb-px flex items-center gap-1.5 rounded-t-md border-b-2 px-2.5 py-1.5 text-xs transition-colors ${RING} data-[state=active]:border-neutral-900 data-[state=active]:font-medium data-[state=active]:text-neutral-900 border-transparent text-neutral-500 hover:text-neutral-900`}
            >
              {entry.name}
              {entry.id === activeId ? (
                <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-white uppercase">
                  Live
                </span>
              ) : null}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value={selected?.id ?? ''} className="pt-4">
          {selected ? (
            <ConfigPanel
              // A fresh panel per config: the draft must not leak across a switch.
              key={selected.id}
              entry={selected}
              isActive={selected.id === activeId}
              keySaved={hasKey(providerIdOf(selected.config))}
              busy={busy}
              onActivate={() => onActivate(selected.id)}
              onSave={(entry) => onSave(selected.id, entry)}
              onDelete={() => onDelete(selected.id)}
              onReplaceKey={onReplaceKey}
              onRemoveKey={onRemoveKey}
              onTest={onTest}
            />
          ) : null}
        </Tabs.Content>
      </Tabs.Root>

      {note ? <p className="mt-3 text-xs text-neutral-600">{note}</p> : null}
    </section>
  );
}

const HEADING = 'text-xs font-medium tracking-wide text-neutral-500 uppercase';

interface Draft {
  name: string;
  npm: string;
  baseURL: string;
  models: string[];
  quick: string;
  balanced: string;
  deep: string;
}

function ConfigPanel({
  entry,
  isActive,
  keySaved,
  busy,
  onActivate,
  onSave,
  onDelete,
  onReplaceKey,
  onRemoveKey,
  onTest,
}: {
  entry: ConfigEntry;
  isActive: boolean;
  keySaved: boolean;
  busy?: boolean;
  onActivate: () => void;
  onSave: (entry: StoredConfigEntry) => void;
  onDelete: () => void;
  onReplaceKey: (providerId: string, apiKey: string) => void;
  onRemoveKey: (providerId: string) => void;
  onTest: () => void;
}) {
  const providerId = providerIdOf(entry.config);
  const [draft, setDraft] = useState<Draft>(() => toDraft(entry, providerId));
  const [apiKey, setApiKey] = useState('');

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-[11px] text-neutral-600">
          {providerId || 'no provider'}
        </span>
        {isActive ? (
          <span className="text-[11px] text-neutral-500">In use right now.</span>
        ) : (
          <button type="button" onClick={onActivate} disabled={busy} className={GHOST}>
            Use this config
          </button>
        )}
      </div>

      <Named label="Name" hint="What this config is called in the menu.">
        <input
          value={draft.name}
          onChange={(event) => patch({ name: event.target.value })}
          className={`${FIELD} ${RING}`}
        />
      </Named>

      <Named label="Transport" hint="How the request is shaped. Presets pick this for you.">
        <select
          value={draft.npm}
          onChange={(event) => patch({ npm: event.target.value })}
          className={`${FIELD} ${RING} cursor-pointer`}
        >
          {TRANSPORTS.map((transport) => (
            <option key={transport.id} value={transport.id}>
              {transport.label}
            </option>
          ))}
        </select>
      </Named>

      <Named label="Base URL" hint="Where the calls go. A local server is usually loopback.">
        <input
          value={draft.baseURL}
          onChange={(event) => patch({ baseURL: event.target.value })}
          placeholder="https://api.example.com/v1"
          className={`${FIELD} ${RING} font-mono`}
        />
      </Named>

      <Named
        label="Key"
        hint={
          keySaved
            ? 'A key is saved for this provider. It is never shown again.'
            : 'No key saved for this provider yet.'
        }
      >
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={keySaved ? 'paste a new key' : 'paste the key'}
            className={`${FIELD} ${RING} font-mono`}
          />
          <button
            type="button"
            disabled={busy || apiKey.trim().length === 0}
            onClick={() => {
              onReplaceKey(providerId, apiKey.trim());
              setApiKey('');
            }}
            className={GHOST}
          >
            Save key
          </button>
          {keySaved ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemoveKey(providerId)}
              className={GHOST}
            >
              Remove
            </button>
          ) : null}
        </div>
      </Named>

      <Named
        label="Models"
        hint="The ids this endpoint serves. Add the ones you want to use — a local server has no list to fetch."
      >
        <div className="space-y-1">
          {draft.models.map((model, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={model}
                onChange={(event) => {
                  const models = [...draft.models];
                  models[index] = event.target.value;
                  patch({ models });
                }}
                placeholder="model-id"
                className={`${FIELD} ${RING} font-mono`}
              />
              <button
                type="button"
                aria-label={`Remove ${model || 'this model'}`}
                onClick={() => patch({ models: draft.models.filter((_, at) => at !== index) })}
                className={`${GHOST} px-1.5 py-1`}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch({ models: [...draft.models, ''] })}
            className={GHOST}
          >
            + Add model id
          </button>
        </div>
      </Named>

      <div className="grid gap-3 sm:grid-cols-3">
        <Named label="Quick" hint="small_model">
          <input
            value={draft.quick}
            list="meant-model-ids"
            onChange={(event) => patch({ quick: event.target.value })}
            placeholder="haiku-class"
            className={`${FIELD} ${RING} font-mono`}
          />
        </Named>
        <Named label="Balanced" hint="model">
          <input
            value={draft.balanced}
            list="meant-model-ids"
            onChange={(event) => patch({ balanced: event.target.value })}
            placeholder="sonnet-class"
            className={`${FIELD} ${RING} font-mono`}
          />
        </Named>
        <Named label="Deep" hint="reasoning_model">
          <input
            value={draft.deep}
            list="meant-model-ids"
            onChange={(event) => patch({ deep: event.target.value })}
            placeholder="opus-class"
            className={`${FIELD} ${RING} font-mono`}
          />
        </Named>
      </div>

      <datalist id="meant-model-ids">
        {draft.models.filter(Boolean).map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(fromDraft(draft, entry, providerId))}
          className={PRIMARY}
        >
          Save
        </button>
        <button type="button" disabled={busy} onClick={onTest} className={GHOST}>
          Test connection
        </button>
        <DeleteConfig name={entry.name} onConfirm={onDelete} />
      </div>
    </div>
  );
}

function DeleteConfig({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={`${GHOST} ml-auto border-red-200 text-red-700 hover:border-red-300 hover:text-red-800`}
        >
          Delete
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 z-50 w-[22rem] -translate-x-1/2 -translate-y-1/2 ${CARD} p-5 shadow-xl`}
        >
          <Dialog.Title className="text-sm font-medium">Delete “{name}”?</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-neutral-500">
            The key stays — it belongs to the provider, not to this config.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className={GHOST}>
                Keep it
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button type="button" onClick={onConfirm} className={PRIMARY}>
                Delete
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddConfigDialog({
  presets,
  onCreate,
}: {
  presets: readonly PresetChoice[];
  onCreate: (draft: NewConfigDraft) => void;
}) {
  const [presetId, setPresetId] = useState<string>(presets[0]?.id ?? 'custom');
  const [name, setName] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [open, setOpen] = useState(false);

  const preset = presets.find((candidate) => candidate.id === presetId);
  const custom = presetId === 'custom';
  const problem = custom
    ? !URL.canParse(baseURL.trim())
      ? 'The base URL has to be a URL.'
      : model.trim()
        ? undefined
        : 'At least one model id is needed.'
    : undefined;

  function submit() {
    onCreate({
      ...(custom ? {} : { presetId }),
      name: name.trim() || preset?.name || 'Config',
      ...(custom ? { baseURL: baseURL.trim(), model: model.trim() } : {}),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    });

    setOpen(false);
    setName('');
    setBaseURL('');
    setModel('');
    setApiKey('');
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={GHOST}>
          + Add config
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[30rem] -translate-x-1/2 -translate-y-1/2 overflow-auto ${CARD} p-5 shadow-xl`}
        >
          <Dialog.Title className="text-sm font-medium">Add a config</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-neutral-500">
            Start from a preset, or point at any endpoint that speaks the OpenAI API.
          </Dialog.Description>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[...presets, { id: 'custom', name: 'Custom (OpenAI-compatible)' }].map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={candidate.id === presetId}
                onClick={() => setPresetId(candidate.id)}
                className={`${RING} rounded-md border px-3 py-2 text-left text-xs ${
                  candidate.id === presetId
                    ? 'border-neutral-900 bg-neutral-50 font-medium'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {candidate.name}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3">
            <Named label="Name" hint="How it shows up in the menu.">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={preset?.name ?? 'My endpoint'}
                className={`${FIELD} ${RING}`}
              />
            </Named>

            {custom ? (
              <>
                <Named label="Base URL" hint="The endpoint calls go to.">
                  <input
                    value={baseURL}
                    onChange={(event) => setBaseURL(event.target.value)}
                    placeholder="https://api.example.com/v1"
                    className={`${FIELD} ${RING} font-mono`}
                  />
                </Named>
                <Named label="Model" hint="The Balanced model. The others can be added next.">
                  <input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="gpt-5.2"
                    className={`${FIELD} ${RING} font-mono`}
                  />
                </Named>
              </>
            ) : (
              <p className="text-xs text-neutral-500">{preset?.notes}</p>
            )}

            <Named
              label="Key"
              hint="Stored in this browser profile. Never synced, never in a page."
            >
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="paste it here"
                className={`${FIELD} ${RING} font-mono`}
              />
            </Named>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            {problem ? <span className="mr-auto text-xs text-neutral-600">{problem}</span> : null}
            <Dialog.Close asChild>
              <button type="button" className={GHOST}>
                Cancel
              </button>
            </Dialog.Close>
            <button type="button" disabled={Boolean(problem)} onClick={submit} className={PRIMARY}>
              Add
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Named({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-500">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span> : null}
    </label>
  );
}

/** A config carries one provider block in practice; that is the one the menu edits. */
function providerIdOf(config: MeantConfig): string {
  return Object.keys(config.provider ?? {})[0] ?? '';
}

/** Tier refs are stored as `provider/model`; the form shows only the model part. */
function modelPart(ref: string | undefined): string {
  if (!ref) return '';

  const separator = ref.indexOf('/');
  return separator === -1 ? ref : ref.slice(separator + 1);
}

function toDraft(entry: ConfigEntry, providerId: string): Draft {
  const provider = entry.config.provider?.[providerId];

  return {
    name: entry.name,
    npm: provider?.npm ?? '@ai-sdk/openai-compatible',
    baseURL: provider?.options?.baseURL ?? '',
    models: Object.keys(provider?.models ?? {}),
    quick: modelPart(entry.config.small_model),
    balanced: modelPart(entry.config.model),
    deep: modelPart(entry.config.reasoning_model),
  };
}

function fromDraft(draft: Draft, entry: ConfigEntry, providerId: string): StoredConfigEntry {
  const previous = entry.config.provider?.[providerId];
  const { baseURL: _replaced, ...otherOptions } = previous?.options ?? {};
  const baseURL = draft.baseURL.trim();
  const options = baseURL ? { ...otherOptions, baseURL } : otherOptions;

  const models = Object.fromEntries(
    draft.models
      .map((model) => model.trim())
      .filter(Boolean)
      .map((model) => [model, previous?.models?.[model] ?? { name: model }]),
  );

  const config: MeantConfig = {
    ...entry.config,
    provider: {
      ...entry.config.provider,
      [providerId]: { ...previous, npm: draft.npm, options, models },
    },
  };

  const tiers = { model: draft.balanced, small_model: draft.quick, reasoning_model: draft.deep };
  for (const [key, model] of Object.entries(tiers) as [
    'model' | 'small_model' | 'reasoning_model',
    string,
  ][]) {
    const ref = model.trim();
    if (ref) config[key] = `${providerId}/${ref}`;
    else delete config[key];
  }

  return { name: draft.name.trim() || entry.name, config };
}
