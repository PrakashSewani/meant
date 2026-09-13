import { PRESETS, defaultConfigFor, presetOrigin, tierRefsFor } from './presets.ts';
import { lintConfig, validateConfig } from './schema.ts';

const problems: string[] = [];
const notes: string[] = [];
const seen = new Set<string>();

for (const preset of PRESETS) {
  if (seen.has(preset.id)) problems.push(`duplicate preset id: ${preset.id}`);
  seen.add(preset.id);

  const result = validateConfig(defaultConfigFor(preset));
  if (!result.ok) {
    problems.push(`${preset.id}: generated config does not parse — ${result.issues.join('; ')}`);
  }

  const origin = presetOrigin(preset);
  if (!origin.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)\/\*$/.test(origin)) {
    problems.push(`${preset.id}: origin must be https or loopback, got ${origin}`);
  }

  if (preset.models.length === 0 && !preset.local) {
    problems.push(`${preset.id}: a hosted preset must ship at least one model`);
  }

  const modelIds = preset.models.map((model) => model.id);
  if (new Set(modelIds).size !== modelIds.length) {
    problems.push(`${preset.id}: duplicate model ids`);
  }

  const refs = tierRefsFor(preset);
  if (!refs.main && !refs.fast && preset.models.length > 0) {
    problems.push(`${preset.id}: models exist but none claim the fast or main tier`);
  }

  for (const warning of lintConfig(defaultConfigFor(preset))) {
    problems.push(`${preset.id}: ${warning.code} at ${warning.path} — ${warning.message}`);
  }

  if (!refs.reasoning) notes.push(`${preset.id}: no reasoning tier — Deep falls back`);
  if (preset.models.length === 0) notes.push(`${preset.id}: model list is user-supplied`);
}

console.log(`validate:config — ${PRESETS.length} presets checked`);
for (const note of notes) console.log(`  note: ${note}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

console.log('  ✓ every preset parses, is scoped to a real origin, and covers the tiers it claims');
