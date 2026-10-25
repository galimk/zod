// @ts-ignore TS6133
import { expect, test, vi } from "vitest";

import * as z from "zod/v3";
import { ZodIssueCode } from "zod/v3";
import { util } from "../helpers/util.js";

const stringSet = z.set(z.string());
type stringSet = z.infer<typeof stringSet>;

const minTwo = z.set(z.string()).min(2);
const maxTwo = z.set(z.string()).max(2);
const justTwo = z.set(z.string()).size(2);
const nonEmpty = z.set(z.string()).nonempty();
const nonEmptyMax = z.set(z.string()).nonempty().max(2);

test("type inference", () => {
  util.assertEqual<stringSet, Set<string>>(true);
});

test("valid parse", () => {
  const result = stringSet.safeParse(new Set(["first", "second"]));
  expect(result.success).toEqual(true);
  if (result.success) {
    expect(result.data.has("first")).toEqual(true);
    expect(result.data.has("second")).toEqual(true);
    expect(result.data.has("third")).toEqual(false);
  }

  expect(() => {
    minTwo.parse(new Set(["a", "b"]));
    minTwo.parse(new Set(["a", "b", "c"]));
    maxTwo.parse(new Set(["a", "b"]));
    maxTwo.parse(new Set(["a"]));
    justTwo.parse(new Set(["a", "b"]));
    nonEmpty.parse(new Set(["a"]));
    nonEmptyMax.parse(new Set(["a"]));
  }).not.toThrow();
});

test("valid parse async", async () => {
  const result = await stringSet.spa(new Set(["first", "second"]));
  expect(result.success).toEqual(true);
  if (result.success) {
    expect(result.data.has("first")).toEqual(true);
    expect(result.data.has("second")).toEqual(true);
    expect(result.data.has("third")).toEqual(false);
  }

  const asyncResult = await stringSet.safeParse(new Set(["first", "second"]));
  expect(asyncResult.success).toEqual(true);
  if (asyncResult.success) {
    expect(asyncResult.data.has("first")).toEqual(true);
    expect(asyncResult.data.has("second")).toEqual(true);
    expect(asyncResult.data.has("third")).toEqual(false);
  }
});

test("valid parse: size-related methods", () => {
  expect(() => {
    minTwo.parse(new Set(["a", "b"]));
    minTwo.parse(new Set(["a", "b", "c"]));
    maxTwo.parse(new Set(["a", "b"]));
    maxTwo.parse(new Set(["a"]));
    justTwo.parse(new Set(["a", "b"]));
    nonEmpty.parse(new Set(["a"]));
    nonEmptyMax.parse(new Set(["a"]));
  }).not.toThrow();

  const sizeZeroResult = stringSet.parse(new Set());
  expect(sizeZeroResult.size).toBe(0);

  const sizeTwoResult = minTwo.parse(new Set(["a", "b"]));
  expect(sizeTwoResult.size).toBe(2);
});

test("failing when parsing empty set in nonempty ", () => {
  const result = nonEmpty.safeParse(new Set());
  expect(result.success).toEqual(false);

  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.too_small);
  }
});

test("failing when set is smaller than min() ", () => {
  const result = minTwo.safeParse(new Set(["just_one"]));
  expect(result.success).toEqual(false);

  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.too_small);
  }
});

test("failing when set is bigger than max() ", () => {
  const result = maxTwo.safeParse(new Set(["one", "two", "three"]));
  expect(result.success).toEqual(false);

  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.too_big);
  }
});

test("doesn’t throw when an empty set is given", () => {
  const result = stringSet.safeParse(new Set([]));
  expect(result.success).toEqual(true);
});

test("throws when a Map is given", () => {
  const result = stringSet.safeParse(new Map([]));
  expect(result.success).toEqual(false);
  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.invalid_type);
  }
});

test("throws when the given set has invalid input", () => {
  const result = stringSet.safeParse(new Set([Symbol()]));
  expect(result.success).toEqual(false);
  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.invalid_type);
    expect(result.error.issues[0].path).toEqual([0]);
  }
});

test("throws when the given set has multiple invalid entries", () => {
  const result = stringSet.safeParse(new Set([1, 2] as any[]) as Set<any>);

  expect(result.success).toEqual(false);
  if (result.success === false) {
    expect(result.error.issues.length).toEqual(2);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.invalid_type);
    expect(result.error.issues[0].path).toEqual([0]);
    expect(result.error.issues[1].code).toEqual(ZodIssueCode.invalid_type);
    expect(result.error.issues[1].path).toEqual([1]);
  }
});

test.each(["max", "size"] as const)("%s rejects oversized sets before parsing elements", async (bound) => {
  const element = vi.fn((value) => value);
  const refinement = vi.fn(() => true);
  const schema = z.object({
    items: z.set(z.preprocess(element, z.string()))[bound](1, "too many").refine(refinement),
  });
  for (const input of [{ items: new Set([0, 1]) }, { items: new Set(["a", "b"]) }]) {
    for (const result of [schema.safeParse(input), await schema.safeParseAsync(input)]) {
      expect(result.success).toBe(false);
      expect(result.error?.issues).toMatchObject([
        { code: "too_big", maximum: 1, path: ["items"], message: "too many" },
      ]);
      expect(result.error?.issues).toHaveLength(1);
    }
  }
  expect(element).not.toHaveBeenCalled();
  expect(refinement).not.toHaveBeenCalled();
});

test("oversized sets do not start async element transforms", async () => {
  const element = vi.fn(async (value: string) => value.length);
  const schema = z.set(z.string().transform(element)).max(0);

  expect(schema.safeParse(new Set(["a"])).success).toBe(false);
  expect((await schema.safeParseAsync(new Set(["a"]))).success).toBe(false);
  expect(element).not.toHaveBeenCalled();
  expect(await schema.parseAsync(new Set())).toEqual(new Set());
});

test("set bounds preserve transformations and lower-bound errors", async () => {
  const element = z.string().transform((value) => value.length);
  for (const schema of [z.set(element).max(1), z.set(element).size(1)]) {
    expect(schema.parse(new Set(["abc"]))).toEqual(new Set([3]));
    expect(await schema.parseAsync(new Set(["abc"]))).toEqual(new Set([3]));
  }
  for (const schema of [z.set(z.string()), z.set(z.string()).min(3), z.set(z.string()).size(3)]) {
    const result = await schema.safeParseAsync(new Set([0, 1]));
    expect(result.error?.issues.filter((issue) => issue.code === "invalid_type")).toHaveLength(2);
  }
});
