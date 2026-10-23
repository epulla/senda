import { startConnection } from "../src/bg/connection";
import { watchPanic } from "../src/bg/approvals";
import { syncBundledTemplates } from "../src/bg/adapters/store";

export default defineBackground(() => {
  startConnection();
  watchPanic();
  void syncBundledTemplates();
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") browser.tabs.create({ url: browser.runtime.getURL("/onboarding.html" as never) });
  });
});
