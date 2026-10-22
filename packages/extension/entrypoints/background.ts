import { startConnection } from "../src/bg/connection";

export default defineBackground(() => {
  startConnection();
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") browser.tabs.create({ url: browser.runtime.getURL("/onboarding.html" as never) });
  });
});
