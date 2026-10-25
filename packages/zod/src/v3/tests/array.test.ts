// @ts-ignore TS6133
import { expect, test, vi } from "vitest";

import * as z from "zod/v3";
import { util } from "../helpers/util.js";

const minTwo = z.string().array().min(2);
const maxTwo = z.string().array().max(2);
const justTwo = z.string().array().length(2);
const intNum = z.string().array().nonempty();
const nonEmptyMax = z.string().array().nonempty().max(2);

type t1 = z.infer<typeof nonEmptyMax>;
util.assertEqual<[string, ...string[]], t1>(true);

type t2 = z.infer<typeof minTwo>;
util.assertEqual<string[], t2>(true);

test("passing validations", () => {
  minTwo.parse(["a", "a"]);
  minTwo.parse(["a", "a", "a"]);
  maxTwo.parse(["a", "a"]);
  maxTwo.parse(["a"]);
  justTwo.parse(["a", "a"]);
  intNum.parse(["a"]);
  nonEmptyMax.parse(["a"]);
});

test("failing validations", () => {
  expect(() => minTwo.parse(["a"])).toThrow();
  expect(() => maxTwo.parse(["a", "a", "a"])).toThrow();
  expect(() => justTwo.parse(["a"])).toThrow();
  expect(() => justTwo.parse(["a", "a", "a"])).toThrow();
  expect(() => intNum.parse([])).toThrow();
  expect(() => nonEmptyMax.parse([])).toThrow();
  expect(() => nonEmptyMax.parse(["a", "a", "a"])).toThrow();
});

test("parse empty array in nonempty", () => {
  expect(() =>
    z
      .array(z.string())
      .nonempty()
      .parse([] as any)
  ).toThrow();
});

test("get element", () => {
  justTwo.element.parse("asdf");
  expect(() => justTwo.element.parse(12)).toThrow();
});

test("continue parsing despite array size error", () => {
  const schema = z.object({
    people: z.string().array().min(2),
  });

  const result = schema.safeParse({
    people: [123],
  });
  expect(result.success).toEqual(false);
  if (!result.success) {
    expect(result.error.issues.length).toEqual(2);
  }
});

test("parse should fail given sparse array", () => {
  const schema = z.array(z.string()).nonempty().min(1).max(3);

  expect(() => schema.parse(new Array(3))).toThrow();
});

test.each(["max", "length"] as const)("%s rejects oversized arrays before parsing elements", async (bound) => {
  const element = vi.fn((value) => value);
  const refinement = vi.fn(() => true);
  const schema = z.object({
    items: z.array(z.preprocess(element, z.string()))[bound](1, "too many").refine(refinement),
  });
  for (const input of [{ items: [0, 1] }, { items: ["a", "b"] }]) {
    for (const result of [schema.safeParse(input), await schema.safeParseAsync(input)]) {
      expect(result.success).toBe(false);
      expect(result.error?.issues).toMatchObject([
        { code: "too_big", maximum: 1, exact: bound === "length", path: ["items"], message: "too many" },
      ]);
      expect(result.error?.issues).toHaveLength(1);
    }
  }
  expect(element).not.toHaveBeenCalled();
  expect(refinement).not.toHaveBeenCalled();
});

test("oversized arrays do not start async element transforms", async () => {
  const element = vi.fn(async (value: string) => value.length);
  const schema = z.array(z.string().transform(element)).max(0);

  expect(schema.safeParse(["a"]).success).toBe(false);
  expect((await schema.safeParseAsync(["a"])).success).toBe(false);
  expect(element).not.toHaveBeenCalled();
  expect(await schema.parseAsync([])).toEqual([]);
});

test("array bounds preserve transformations and lower-bound errors", async () => {
  const element = z.string().transform((value) => value.length);
  for (const schema of [z.array(element).max(1), z.array(element).length(1)]) {
    expect(schema.parse(["abc"])).toEqual([3]);
    expect(await schema.parseAsync(["abc"])).toEqual([3]);
  }
  for (const schema of [z.array(z.string()), z.array(z.string()).min(3), z.array(z.string()).length(3)]) {
    const result = await schema.safeParseAsync([0, 1]);
    expect(result.error?.issues.filter((issue) => issue.code === "invalid_type")).toHaveLength(2);
  }
});
