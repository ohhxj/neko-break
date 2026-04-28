export type RouterSnapshot = {
  isReady: boolean;
  route: "setup" | "dashboard";
};

export const createRouterSnapshot = (setupComplete: boolean): RouterSnapshot => ({
  isReady: setupComplete,
  route: setupComplete ? "dashboard" : "setup"
});
