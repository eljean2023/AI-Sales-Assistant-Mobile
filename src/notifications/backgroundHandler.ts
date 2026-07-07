import messaging from "@react-native-firebase/messaging";

import { showFromRemoteMessage } from "./localDisplay";

// Registered once, at the top of index.js, before the app renders — required
// by React Native Firebase so this fires even while the app is backgrounded
// or killed.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // Messages sent with a `notification` block are displayed automatically by
  // the OS in background/killed state. Data-only messages need to be shown
  // manually, which we can still do here even without a rendered app.
  if (!remoteMessage.notification) {
    await showFromRemoteMessage(remoteMessage);
  }
});
