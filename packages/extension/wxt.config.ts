import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// The Chrome Web Store rejects uploads with a key; SENDA_STORE=1 builds without it.
const store = process.env.SENDA_STORE ? '-store' : '';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDirTemplate: `{{browser}}-mv{{manifestVersion}}{{modeSuffix}}${store}`,
  zip: { artifactTemplate: `senda-extension-{{version}}-{{browser}}${store}.zip` },
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: ({ browser }) => {
    const chromium = browser !== 'firefox' && browser !== 'safari';
    return {
      name: '__MSG_extName__',
      description: '__MSG_extDescription__',
      default_locale: 'en',
      permissions: ['tabs', 'scripting', 'storage', 'alarms', ...(chromium ? ['tabGroups', 'sidePanel'] : [])],
      host_permissions: ['<all_urls>'],
      ...(chromium && !store && {
        key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApRsYRk1eQMJDV8X2DONcXlKVPXuGLsGETCsNZ8v59wFBLgSXliRXWROqB0ghWWUT5jyvWDBFQwWcKq6XuwuUTry9RuRx77nx4IC1vsRBLd4sDNv6Ly7WQeCRiaZ3Is2LWn8aWz+GnB3QI6Z8LSH4THcUzHpPNvcjRuEvlmw4x1k8YxpM539DGNByg+mFnOMN0HaRc5ks2893GedE46lZcKKtpoLgJmpLmEU6U4ot+rcERkLq/n3JgqobwOiOVSw68eTjriWKfRTEweiizddv/d83bK0vhNcxWAswXNypCKXpMaMJ0qf/JBsB4Uj2nj4RuCh3PD/givPnDZrQ+lWcBwIDAQAB',
      }),
      ...(browser === 'firefox' && { browser_specific_settings: { gecko: { id: 'senda@epulla' } } }),
    };
  },
});
