# Amazon DynamoDB

**Level:** 2 · **Versions tested:** DynamoDB Local 2.5.2 (tested). The real AWS service uses the same API and the same request signing (verified against AWS's published SigV4 test vector), but **has not been tested against AWS**, so it is not confirmed to work there. Test it with a read-only IAM user or a throwaway table before relying on it.

## Authentication and transport
Access keys (access key ID, secret access key, optional session token), signed with SigV4 over HTTPS. Keys typed in the connection win; otherwise the **AWS profile** field reads a profile of `~/.aws/credentials` (or `AWS_SHARED_CREDENTIALS_FILE`; the region comes from `~/.aws/config`); otherwise the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` environment variables are used. Profiles that need SSO, role assumption (`role_arn`) or a helper program (`credential_process`) are refused with a message: export temporary keys and paste them into the session-token field. The profile support is tested against a local endpoint that records how requests are signed, **not against AWS**. Set an endpoint host/port/TLS for DynamoDB Local or a VPC endpoint.

## Capabilities
PartiQL editor (runs in the SQL editor mode): `SELECT`/`INSERT`/`UPDATE`/`DELETE`, positional `?` parameters, global secondary indexes (`FROM "table"."index"`), automatic paging, tables/keys/indexes in the explorer. Not editable in the grid.

## Type notes
Numbers are exact (integers beyond 2^53 are `bigint`, unrepresentable decimals stay text). Lists, maps and sets are shown as JSON. Items are schemaless: columns come from the first page; attributes first seen later are not shown (a message says so).

## Limits (honest)
- A `SELECT` without a key condition is a full table **scan** that consumes read capacity; the risk classifier notes it but does not block it.
- No transactions, no `CreateTable`/DDL (those are not PartiQL), no streams, no PITR/backup tooling.
- Throttling is reported as a timeout error; there is no automatic retry/backoff.

## Read-only enforcement
Client-side: only `SELECT`/`EXISTS` run on a read-only connection (default-deny). For a server-side guarantee use an IAM policy limited to read actions.

## External tools
none

## Driver license
none (built on node:http and node:crypto)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d dynamodb` then `pnpm --filter @rizomadb/driver-dynamodb test` (port 18000, override with `RZ_DYNAMODB_PORT`).
