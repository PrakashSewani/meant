import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { curatedMatchPatterns } from '@meant/core';
import { PROVIDER_ORIGINS } from '@meant/config';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  zip: { name: 'meant' },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Meant',
    description: 'Turn messy intent into the right register, in any text box.',
    // The curated hosts are the sites Meant ships support for. The grant is also what lets the
    // worker inject the bar bundle into a frame on first invoke — a content-script match alone
    // does not permit that. Everything else stays optional (D-004).
    host_permissions: curatedMatchPatterns(),
    permissions: ['storage', 'contextMenus', 'activeTab', 'scripting', 'alarms'],
    optional_permissions: ['sidePanel'],
    // Declared broadly so any site can be enabled from a user gesture. A runtime grant covers
    // both the content script and the bar injection for that origin.
    optional_host_permissions: [...PROVIDER_ORIGINS, 'https://*/*'],
    commands: {
      'invoke-register-bar': {
        suggested_key: { default: 'Alt+J' },
        description: 'Open the Register Bar on the current selection',
      },
    },
  },
});
