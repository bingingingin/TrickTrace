import { expect, it } from "vitest";
import { boardFromHands, play } from "../src/core/cards";
import { classifyPlay, lowestEquivalent } from "../src/core/play-knowledge";

it("distinguishes opening lead, later lead, follow, ruff and discard", () => {
  let p = boardFromHands(["A.2.-.-", "K.-.2.-", "Q.3.-.-", "-.-.-.2"]).position;
  p.contract.strain = "D";
  p.leader = "N";
  expect(classifyPlay(p, "SA")).toBe("opening-lead");
  p = play(p, "SA");
  expect(classifyPlay(p, "SK")).toBe("follow");
  p = play(p, "SK");
  expect(classifyPlay(p, "SQ")).toBe("follow");
  p = play(p, "SQ");
  expect(classifyPlay(p, "C2")).toBe("discard");
  p = play(p, "C2");
  expect(classifyPlay(p, "H2")).toBe("lead");
  p = play(p, "H2");
  expect(classifyPlay(p, "D2")).toBe("ruff");
});

it("selects the lowest point value before the stable suit order", () => {
  expect(lowestEquivalent(["HA", "S3", "C3", "D7"])).toBe("S3");
});
