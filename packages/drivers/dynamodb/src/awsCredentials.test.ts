import { describe, it, expect } from "vitest";
import { awsKeysFromEnv, AwsProfileError, loadAwsProfile, parseIni } from "./awsCredentials.js";

const files: Record<string, string> = {
  "/c": `# comment\n[default]\naws_access_key_id = AKIADEFAULT\naws_secret_access_key = s3cr3t=with=equals\n\n[work]\naws_access_key_id=AKIAWORK\naws_secret_access_key=wk\naws_session_token = tok\n\n[sso]\naws_access_key_id=x\naws_secret_access_key=y\n\n[nokeys]\nfoo=bar\n`,
  "/f": `[default]\nregion = eu-west-1\n\n[profile work]\nregion = us-west-2\n\n[profile sso]\nsso_session = corp\n\n[profile assume]\nrole_arn = arn:aws:iam::1:role/x\nsource_profile = default\n`,
};
const env = { AWS_SHARED_CREDENTIALS_FILE: "/c", AWS_CONFIG_FILE: "/f" };
const read = (p: string) => { if (p in files) return files[p]!; throw new Error("ENOENT"); };

describe("AWS shared credentials", () => {
  it("parses sections, comments and values that contain '='", () => {
    expect(parseIni(files["/c"]!).default).toEqual({ aws_access_key_id: "AKIADEFAULT", aws_secret_access_key: "s3cr3t=with=equals" });
  });
  it("reads keys, session token and region of a profile", () => {
    expect(loadAwsProfile("default", env, read)).toEqual({ accessKeyId: "AKIADEFAULT", secretAccessKey: "s3cr3t=with=equals", region: "eu-west-1" });
    expect(loadAwsProfile("work", env, read)).toEqual({ accessKeyId: "AKIAWORK", secretAccessKey: "wk", sessionToken: "tok", region: "us-west-2" });
  });
  it("refuses profiles that need SSO or role assumption, and profiles without keys", () => {
    expect(() => loadAwsProfile("sso", env, read)).toThrow(/sso_session/);
    expect(() => loadAwsProfile("assume", env, read)).toThrow(/role_arn/);
    expect(() => loadAwsProfile("nokeys", env, read)).toThrow(/no access keys/);
    expect(() => loadAwsProfile("missing", env, read)).toThrow(AwsProfileError);
    expect(() => loadAwsProfile("default", env, () => { throw new Error("ENOENT"); })).toThrow(/No AWS credentials file/);
  });
  it("reads the standard environment variables only when both keys are set", () => {
    expect(awsKeysFromEnv({ AWS_ACCESS_KEY_ID: "a", AWS_SECRET_ACCESS_KEY: "b", AWS_SESSION_TOKEN: "t", AWS_REGION: "sa-east-1" })).toEqual({ accessKeyId: "a", secretAccessKey: "b", sessionToken: "t", region: "sa-east-1" });
    expect(awsKeysFromEnv({ AWS_ACCESS_KEY_ID: "a" })).toBeUndefined();
  });
});
