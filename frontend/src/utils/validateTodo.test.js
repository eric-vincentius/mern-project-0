import { describe, it, expect } from "vitest";
import { validateTodoTitle } from "./validateTodo";

describe("Todo title validation", () => {
    it("accepts a valid title", () => {
        expect(validateTodoTitle("Learn MERN")).toBe(true);
    });

    it("rejects whitespace-only titles", () => {
        expect(validateTodoTitle(" ")).toBe(false);
    });

    it("rejects an empty title", () => {
        expect(validateTodoTitle("")).toBe(false);
    })

    it("rejects non-string values", () => {
        expect(validateTodoTitle(null)).toBe(false);
        expect(validateTodoTitle(123)).toBe(false);
        expect(validateTodoTitle({ title: "test" })).toBe(false);
    });

    it("accepts a 99-character title", () => {
        expect(validateTodoTitle("a".repeat(99))).toBe(true);
    })

    it("accepts exactly 100 characters", () => {
        expect(validateTodoTitle("a".repeat(100))).toBe(true);
    })

    it("rejects 101 characters", () => {
        expect(validateTodoTitle("a".repeat(101))).toBe(false);
    })

    it("trims whitespace before validation", () => {
        expect(validateTodoTitle(` ${"a".repeat(100)}`)).toBe(true);
    })
})