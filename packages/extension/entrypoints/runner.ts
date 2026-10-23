import { runRecipe } from '../src/injected/runner';

export default defineUnlistedScript(() => {
  (globalThis as any).__sendaRun = runRecipe;
});
