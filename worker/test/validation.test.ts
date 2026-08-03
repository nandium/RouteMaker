import { describe, expect, it } from "vitest";
import {
  validateGrade,
  validateGymCoordinates,
  validateBaselineJpeg,
} from "../src/routes";
import { JPEG } from "./fixture";

describe("route input security", () => {
  it("normalizes grades and rejects out-of-range grades", async () => {
    expect(validateGrade("v4")).toBe("V4");
    try {
      validateGrade("V99");
      throw new Error("expected rejection");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(422);
    }
  });

  it("requires bounded JPEG dimensions", () => {
    const oversized = JPEG.slice();
    const frame = oversized.findIndex(
      (value, index) => value === 0xff && oversized[index + 1] === 0xc0,
    );
    oversized[frame + 7] = 0x09;
    oversized[frame + 8] = 0x61;
    expect(validateBaselineJpeg(JPEG)).toBe(true);
    expect(validateBaselineJpeg(oversized)).toBe(false);
    const progressive = JPEG.slice();
    const progressiveFrame = progressive.findIndex(
      (value, index) => value === 0xff && progressive[index + 1] === 0xc0,
    );
    progressive[progressiveFrame + 1] = 0xc2;
    expect(validateBaselineJpeg(progressive)).toBe(false);
    expect(
      validateBaselineJpeg(
        new Uint8Array([
          0xff, 0xd8, 0xff, 0xc0, 0x00, 0x07, 0x08, 0x00, 0x01, 0x00, 0x01,
          0xff, 0xd9,
        ]),
      ),
    ).toBe(false);
    expect(validateBaselineJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(
      false,
    );
  });

  it("accepts only finite numeric gym coordinates", () => {
    expect(validateGymCoordinates(1.3, 103.8)).toEqual([1.3, 103.8]);
    for (const [latitude, longitude] of [
      [null, 103.8],
      [false, 103.8],
      ["1.3", 103.8],
      [[], 103.8],
      [Number.NaN, 103.8],
      [1.3, Infinity],
    ] as const) {
      expect(() => validateGymCoordinates(latitude, longitude)).toThrow(
        Response,
      );
    }
  });
});
