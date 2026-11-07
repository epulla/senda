import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// The Chrome Web Store rejects uploads with a key; SENDA_STORE=1 builds without it.
const store = process.env.SENDA_STORE ? '-store' : '';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDirTemplate: `{{browser}}-mv{{manifestVersion}}${store}`,
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
        key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwKc7Zfj2zMhW85ScW0N1PnBvvKVwYl2VVkYINwrTigepzsEAI+gdWKncuBFIfpX2DOPcmIPnQf3JGnX5Xl5YBKOqovJlFWIb7LVfyeS3ZLYWNYrkIRFki4Rl1inUHaYev3vElFdQH6r7FlxuEtsk60hWxGHbyE/LrjcJ3AGUMfhBqlQYIz6ZfaomX+CK/dihezsNge6YixbAkJOaa6WtvShXxZ7lx2Z7aAY6we79mxW6z2D80TPxpcRUIGYKgMRwcgJ74qbnmklBxEfQZE/hTTgtF3PCCP8pBqPyoptZK9vNF5uz8e7iiwAaebEdNHUSNKPql546mTRkIW93DRwVrwIDAQAB',
      }),
      ...(browser === 'firefox' && { browser_specific_settings: { gecko: { id: 'senda@epulla' } } }),
    };
  },
});
