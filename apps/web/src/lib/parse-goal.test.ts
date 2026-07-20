import { describe, expect, it } from "vitest";
import { parseGoalPrompt } from "./parse-goal";

describe("parseGoalPrompt", () => {
  it("reads minute durations", () => {
    expect(parseGoalPrompt("I want a 55 minutes session").durationMin).toBe(55);
    expect(parseGoalPrompt("go for 75 min tempo").durationMin).toBe(75);
    expect(parseGoalPrompt("1.5 hours endurance").durationMin).toBe(90);
  });

  it("reads intensity and terrain", () => {
    const p = parseGoalPrompt(
      "55 min tempo ride, some hills, avoid busy roads",
    );
    expect(p.durationMin).toBe(55);
    expect(p.intensity).toBe("tempo");
    expect(p.terrainBias).toBe("hilly");
    expect(p.avoidBusyRoads).toBe(true);
  });

  it("clamps extreme durations", () => {
    expect(parseGoalPrompt("10 min spin").durationMin).toBe(30);
    expect(parseGoalPrompt("400 minutes epic").durationMin).toBe(300);
  });
});
