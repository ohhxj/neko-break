export type RestPromptPeriod = "morning" | "noon" | "evening" | "late" | "general";

const promptPools: Record<RestPromptPeriod, readonly string[]> = {
  morning: [
    "早上好，人类。先眨眨眼睛，今天慢慢来。",
    "新的一天也别太用力，看看远处再继续。",
    "眼睛开工很久啦，先让它们喘口气。"
  ],
  noon: [
    "到饭点啦，离开屏幕一会儿，好好吃饭。",
    "人类，该补充能量了，先把工作放一放。",
    "中午休息一下吧，小猫替你看一会儿屏幕。"
  ],
  evening: [
    "辛苦一天了，放松肩膀，看看窗外吧。",
    "到下班时间附近啦，别把疲惫一起带回家。",
    "今天已经做得很好了，先让眼睛下班一会儿。"
  ],
  late: [
    "已经很晚啦，眼睛也准备下班了。",
    "人类，夜深了。离开屏幕一会儿吧。",
    "今天先到这里也可以，休息不是偷懒。"
  ],
  general: [
    "人类，离开屏幕一会儿，眨眨眼睛。",
    "看看远处，让眼睛松一口气。",
    "肩膀放下来，慢慢呼吸一下。",
    "喝口水吧，小猫替你看一会儿屏幕。",
    "站起来走两步，回来再继续。",
    "你已经认真很久了，现在轮到身体被照顾一下。",
    "工作不会跑，先把自己捡回来一分钟。"
  ]
};

export const DEFAULT_REST_PROMPT = promptPools.general[0];

const minutesSinceMidnight = (date: Date) => date.getHours() * 60 + date.getMinutes();

export const restPromptPeriodAt = (date: Date): RestPromptPeriod => {
  const minutes = minutesSinceMidnight(date);
  if (minutes >= 8 * 60 + 30 && minutes < 10 * 60 + 30) return "morning";
  if (minutes >= 11 * 60 + 30 && minutes < 13 * 60 + 30) return "noon";
  if (minutes >= 17 * 60 + 30 && minutes < 19 * 60 + 30) return "evening";
  if (minutes >= 22 * 60 || minutes < 6 * 60) return "late";
  return "general";
};

export const pickRestPrompt = (
  date: Date,
  previousPrompt: string | null,
  random: () => number = Math.random
) => {
  const pool = promptPools[restPromptPeriodAt(date)];
  const candidates = pool.filter((prompt) => prompt !== previousPrompt);
  const available = candidates.length > 0 ? candidates : pool;
  const index = Math.min(available.length - 1, Math.floor(Math.max(0, random()) * available.length));
  return available[index];
};

export const createRestPromptPicker = (random: () => number = Math.random) => {
  let previousPrompt: string | null = null;

  return {
    next(date: Date = new Date()) {
      const prompt = pickRestPrompt(date, previousPrompt, random);
      previousPrompt = prompt;
      return prompt;
    }
  };
};
