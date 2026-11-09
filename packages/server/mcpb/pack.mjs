// Builds dist/senda.mcpb (Claude Desktop bundle) around the standalone dist/index.js.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const at = (path) => new URL(path, import.meta.url);
const stage = at('../dist/mcpb/');
const { version } = JSON.parse(readFileSync(at('../package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(at('manifest.json'), 'utf8'));

rmSync(stage, { recursive: true, force: true });
mkdirSync(at('../dist/mcpb/server/'), { recursive: true });
copyFileSync(at('../dist/index.js'), at('../dist/mcpb/server/senda-mcp.mjs'));
copyFileSync(at('../../../docs/assets/brand/avatar-512.png'), at('../dist/mcpb/icon.png'));
writeFileSync(at('../dist/mcpb/manifest.json'), JSON.stringify({ ...manifest, version }, null, 2));
execFileSync('pnpm', ['dlx', '@anthropic-ai/mcpb@2.1.2', 'pack', stage.pathname, at('../dist/senda.mcpb').pathname], { stdio: 'inherit' });
