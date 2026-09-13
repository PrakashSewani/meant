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
    // Declared broadly so any site can be enabled from a user gesture; the *granted* set stays
    // one origin at a time and is revocable (D-004). Nothing here is granted at install.
    optional_host_permissions: [...PROVIDER_ORIGINS, 'https://*/*'],
    commands: {
      'invoke-register-bar': {
        suggested_key: { default: 'Alt+J' },
        description: 'Open the Register Bar on the current selection',
      },
    },
  },
});
