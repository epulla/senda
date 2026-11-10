import { runRecipe } from '../src/injected/runner';
import { pressKey, pressKeyAction, realClick, typeText } from '../src/injected/input';

export default defineUnlistedScript(() => {
  (globalThis as any).__sendaRun = runRecipe;
  (globalThis as any).__sendaInput = { realClick, typeText, pressKey, pressKeyAction };
});
