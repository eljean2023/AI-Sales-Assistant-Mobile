export const logger = {
  info: (...args: unknown[]) => {
    if (__DEV__) console.log("[AISalesAssistant]", ...args);
  },
  error: (...args: unknown[]) => {
    if (__DEV__) console.error("[AISalesAssistant]", ...args);
  },
};
