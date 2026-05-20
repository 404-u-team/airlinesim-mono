import { airlineSimEventBus } from "@airlinesim/event-bus";
import { createApp } from "vue";

import App from "./App.vue";
import { restoreAuthSession } from "./auth";
import { router } from "./router";
import "./style.css";

restoreAuthSession();

airlineSimEventBus.on("navigation:intent", (event) => {
  if (event.replace) {
    void router.replace(event.targetPath);
    return;
  }

  void router.push(event.targetPath);
});

createApp(App).use(router).mount("#app");
