import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import type { ConfigEntry, MeantConfig, StoredConfigEntry } from '@meant/config';
import { CARD, FIELD, GHOST, LABEL, MUTED, PRIMARY, RING } from '../styles';

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
      <section className={`${CARD} p-4 shadow-sm`}>
        <p className={`text-xs ${MUTED}`}>
          No configs yet. Add a provider to give it a key and pick the models each Effort uses.
        </p>
        <div className="mt-3">
          <AddConfigDialog presets={presets} onCreate={onCreate} />
        </div>
      </section>
    );
  }

  return (
    <section className={`${CARD} p-4 shadow-sm`}>
      <Tabs.Root value={selected?.id} onValueChange={setViewing} activationMode="manual">
        <div className="flex items-end gap-2">
          <Tabs.List className="flex min-w-0 flex-1 flex-wrap items-center gap-1 border-b border-neutral-200 dark:border-neutral-800">
            {entries.map((entry) => (
              <Tabs.Trigger
                key={entry.id}
                value={entry.id}
                className={`-mb-px flex items-center gap-1.5 rounded-t-md border-b-2 border-transparent px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-900 data-[state=active]:border-neutral-900 data-[state=active]:font-medium data-[state=active]:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 dark:data-[state=active]:border-neutral-100 dark:data-[state=active]:text-neutral-100 ${RING}`}
              >
                {entry.name}
                {entry.id === activeId ? (
                  <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-white uppercase dark:bg-neutral-100 dark:text-neutral-900">
                    Live
                  </span>
                ) : null}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="pb-1">
            <AddConfigDialog presets={presets} onCreate={onCreate} />
          </div>
        </div>

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

      {note ? <p className={`mt-3 text-xs ${MUTED}`}>{note}</p> : null}
    </section>
  );
}

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
    <div className="space-y-5">
      {/* Three short fields across, then the two that hold more than a value, then the tiers. Every
          row is the same rhythm, and no column is left half empty. */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Named label="Name">
          <input
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="Anthropic"
            className={`${FIELD} ${RING}`}
          />
        </Named>

        <Named label="Transport">
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

        <Named label="Base URL">
          <input
            value={draft.baseURL}
            onChange={(event) => patch({ baseURL: event.target.value })}
            placeholder="https://api.example.com/v1"
            className={`${FIELD} ${RING} font-mono`}
          />
        </Named>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Named label={`Key · ${providerId || 'no provider'}`}>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={keySaved ? 'saved — paste a new one' : 'paste the key'}
              className={`${FIELD} ${RING} font-mono`}
            />
            <button
              type="button"
              disabled={busy || apiKey.trim().length === 0}
              onClick={() => {
                onReplaceKey(providerId, apiKey.trim());
                setApiKey('');
              }}
              className={`${GHOST} shrink-0 whitespace-nowrap`}
            >
              Save key
            </button>
            {keySaved ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemoveKey(providerId)}
                className={`${GHOST} shrink-0`}
              >
                Remove
              </button>
            ) : null}
          </div>
        </Named>

        <Named label="Models">
          <div className="space-y-1.5">
            {draft.models.length === 0 ? (
              <p className={MUTED}>Add the model id your server serves.</p>
            ) : null}
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
                  className={`${GHOST} shrink-0 px-1.5 py-1`}
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
              + Add model
            </button>
          </div>
        </Named>
      </div>

      {/* Three model ids side by side are readable; stacked they are a column of near-identical
          inputs with nothing to tell them apart. */}
      <Named label="Effort uses">
        <div className="grid gap-5 sm:grid-cols-3">
          <input
            value={draft.quick}
            list="meant-model-ids"
            aria-label="Quick model"
            onChange={(event) => patch({ quick: event.target.value })}
            placeholder="Quick"
            className={`${FIELD} ${RING} font-mono`}
          />
          <input
            value={draft.balanced}
            list="meant-model-ids"
            aria-label="Balanced model"
            onChange={(event) => patch({ balanced: event.target.value })}
            placeholder="Balanced"
            className={`${FIELD} ${RING} font-mono`}
          />
          <input
            value={draft.deep}
            list="meant-model-ids"
            aria-label="Deep model"
            onChange={(event) => patch({ deep: event.target.value })}
            placeholder="Deep"
            className={`${FIELD} ${RING} font-mono`}
          />
        </div>
      </Named>

      <datalist id="meant-model-ids">
        {draft.models.filter(Boolean).map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-5 dark:border-neutral-800">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(fromDraft(draft, entry, providerId))}
          className={isActive ? PRIMARY : GHOST}
        >
          Save
        </button>
        {isActive ? null : (
          <button type="button" disabled={busy} onClick={onActivate} className={GHOST}>
            Use this config
          </button>
        )}
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
          className={`${GHOST} ml-auto border-red-200 text-red-700 hover:border-red-300 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:border-red-800 dark:hover:text-red-200`}
        >
          Delete
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 dark:bg-black/50" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 z-50 w-[24rem] -translate-x-1/2 -translate-y-1/2 ${CARD} p-5 shadow-xl`}
        >
          <Dialog.Title className="text-sm font-medium">Delete “{name}”?</Dialog.Title>
          <Dialog.Description className={`mt-1 text-xs ${MUTED}`}>
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
        <button type="button" className={`${GHOST} shrink-0`}>
          + Add config
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 dark:bg-black/50" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[34rem] -translate-x-1/2 -translate-y-1/2 overflow-auto ${CARD} p-5 shadow-xl`}
        >
          <Dialog.Title className="text-sm font-medium">Add a config</Dialog.Title>
          <Dialog.Description className={`mt-1 text-xs ${MUTED}`}>
            Start from a preset, or point at any endpoint that speaks the OpenAI API.
          </Dialog.Description>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[...presets, { id: 'custom', name: 'Custom (OpenAI-compatible)' }].map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={candidate.id === presetId}
                onClick={() => setPresetId(candidate.id)}
                className={`${RING} rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                  candidate.id === presetId
                    ? 'border-neutral-900 bg-neutral-50 font-medium dark:border-neutral-100 dark:bg-neutral-800'
                    : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600'
                }`}
              >
                {candidate.name}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Named label="Name">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={preset?.name ?? 'My endpoint'}
                className={`${FIELD} ${RING}`}
              />
            </Named>

            <Named label="Key">
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="paste it here"
                className={`${FIELD} ${RING} font-mono`}
              />
            </Named>

            {custom ? (
              <>
                <Named label="Base URL">
                  <input
                    value={baseURL}
                    onChange={(event) => setBaseURL(event.target.value)}
                    placeholder="https://api.example.com/v1"
                    className={`${FIELD} ${RING} font-mono`}
                  />
                </Named>
                <Named label="Balanced model">
                  <input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="gpt-5.2"
                    className={`${FIELD} ${RING} font-mono`}
                  />
                </Named>
              </>
            ) : (
              <p className={`text-xs sm:col-span-2 ${MUTED}`}>{preset?.notes}</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            {problem ? <span className={`mr-auto text-xs ${MUTED}`}>{problem}</span> : null}
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

function Named({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className={LABEL}>{label}</span>
      {children}
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
