import { describe, expect, it } from "vitest";
import {
  createRestPromptPicker,
  pickRestPrompt,
  restPromptPeriodAt
} from "../../src/domain/breaks/rest-prompts";

const at = (hour: number, minute = 0) => new Date(2026, 6, 24, hour, minute);

describe("rest prompts", () => {
  it("uses time-specific prompt periods around 09:00, 12:00 and 18:00", () => {
    expect(restPromptPeriodAt(at(9))).toBe("morning");
    expect(restPromptPeriodAt(at(12))).toBe("noon");
    expect(restPromptPeriodAt(at(18))).toBe("evening");
  });

  it("uses late prompts at night and general prompts during ordinary hours", () => {
    expect(restPromptPeriodAt(at(23))).toBe("late");
    expect(restPromptPeriodAt(at(2))).toBe("late");
    expect(restPromptPeriodAt(at(15))).toBe("general");
  });

  it("selects copy from the active time period", () => {
    expect(pickRestPrompt(at(9), null, () => 0)).toContain("早上好");
    expect(pickRestPrompt(at(12), null, () => 0)).toContain("饭点");
    expect(pickRestPrompt(at(18), null, () => 0)).toContain("辛苦一天");
  });

  it("does not repeat the previous prompt consecutively", () => {
    const picker = createRestPromptPicker(() => 0);
    const first = picker.next(at(15));
    const second = picker.next(at(15));

    expect(second).not.toBe(first);
  });
});
