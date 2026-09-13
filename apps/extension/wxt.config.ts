import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { PROVIDER_ORIGINS } from '@sayable/config';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Sayable',
    description: 'Turn messy intent into the right register, in any text box.',
    permissions: ['storage', 'contextMenus', 'activeTab', 'scripting', 'alarms'],
    optional_permissions: ['sidePanel'],
    // Nothing provider-related is granted at install. Enabling a preset in the options page
    // requests exactly that origin, once (D-004).
    optional_host_permissions: [...PROVIDER_ORIGINS],
    commands: {
      'invoke-register-bar': {
        suggested_key: { default: 'Alt+J' },
        description: 'Open the Register Bar on the current selection',
      },
    },
  },
});
