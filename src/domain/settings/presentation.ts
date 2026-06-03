import type { OverlayStyle } from "./types";

export const overlayStyleLabel = (style: OverlayStyle) => {
  if (style === "floating") return "可爱弹窗";
  return "全屏播放";
};

export const overlayStyleDescription = (style: OverlayStyle) => {
  if (style === "floating") {
    return "右下角轻提醒，小猫和倒计时会温柔打断你一下。";
  }

  return "沉浸式全屏休息，更适合强提醒和彻底切换状态。";
};
