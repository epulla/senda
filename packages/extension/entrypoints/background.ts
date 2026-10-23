import { startConnection } from "../src/bg/connection";
import { watchPanic } from "../src/bg/approvals";

export default defineBackground(() => {
  startConnection();
  watchPanic();
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") browser.tabs.create({ url: browser.runtime.getURL("/onboarding.html" as never) });
  });
});
