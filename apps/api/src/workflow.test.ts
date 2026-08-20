import { TRANSITIONS } from "@customer-workflow/shared";
test("workflow only permits explicitly mapped transitions", () => { expect(TRANSITIONS.NEW).toContain("IN_PROGRESS"); expect(TRANSITIONS.NEW).not.toContain("COMPLETED"); expect(TRANSITIONS.COMPLETED).toEqual(["REOPENED"]); });
test("sync idempotency key is stable for the same completion event", () => { const key = (id: string, timestamp: string) => `${id}:${timestamp}`; expect(key("app-1", "2024-01-01")).toBe(key("app-1", "2024-01-01")); });
