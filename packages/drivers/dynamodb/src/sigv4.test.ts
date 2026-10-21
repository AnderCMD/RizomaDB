import { describe, it, expect } from "vitest";
import { signV4 } from "./sigv4.js";

describe("SigV4", () => {
  it("matches AWS's published get-vanilla test vector", () => {
    const h = signV4({ accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY" },
      { method: "GET", host: "example.amazonaws.com", path: "/", headers: {}, body: "", region: "us-east-1", service: "service", now: new Date("2015-08-30T12:36:00Z") });
    expect(h.authorization).toBe("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
  });
  it("signs the session token when present", () => {
    const h = signV4({ accessKeyId: "A", secretAccessKey: "s", sessionToken: "tok" }, { method: "POST", host: "h", path: "/", headers: { "content-type": "x" }, body: "{}", region: "r", service: "dynamodb", now: new Date("2020-01-01T00:00:00Z") });
    expect(h.authorization).toContain("SignedHeaders=content-type;host;x-amz-date;x-amz-security-token");
  });
});
