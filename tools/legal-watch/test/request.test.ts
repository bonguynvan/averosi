import { describe, expect, test } from "vitest";
import { buildAgentRequest, TRUSTED_DOMAINS } from "../src/request";
import { STATE } from "./fixtures";

describe("buildAgentRequest", () => {
  const body = buildAgentRequest(STATE, "2026-10-08", "low");

  test("searches only since the last review, on trusted domains", () => {
    const search = body.tools[0];
    expect(search?.type).toBe("web_search");
    expect(search?.filters.search_date_filter).toEqual({ start_date: "2026-10-01", end_date: "2026-10-08" });
    expect(search?.filters.search_domain_filter).toEqual([...TRUSTED_DOMAINS]);
    expect(TRUSTED_DOMAINS.length).toBeLessThanOrEqual(20);
    expect(TRUSTED_DOMAINS).toContain("chinhphu.vn");
  });

  test("tells the model what is already known so it reports only changes", () => {
    expect(body.input).toContain("284/2026/NĐ-CP");
    expect(body.input).toContain("32/2026/TT-BTC");
    expect(body.input).toContain("Chưa có tổ chức nào được cấp phép chính thức");
  });

  test("forces a JSON-schema answer with a low temperature", () => {
    expect(body.preset).toBe("low");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.required).toEqual(["changes", "licensing"]);
    expect(body.temperature).toBeLessThanOrEqual(0.2);
  });
});
