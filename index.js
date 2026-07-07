// Must run before anything else: registers the FCM handler that fires while
// the app is backgrounded or killed. React Native Firebase requires this to
// be set up outside the React tree, at the top of the entry file.
import "./src/notifications/backgroundHandler";

import "expo-router/entry";
