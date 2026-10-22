<p align="center"><img src="https://raw.githubusercontent.com/AnderCMD/RizomaDB/main/assets/brand/logo-mark.svg" alt="RizomaDB" width="56"></p>

# Google Cloud Firestore

**Level:** 2 · **Versions tested:** the Firestore emulator (Google Cloud CLI `emulators` image, Firestore Native mode, REST API v1) (tested). **Google Cloud itself has not been tested**, so it is not confirmed to work there; the requests are the same REST calls, with a bearer token. Test it with a read-only account or a throwaway project before relying on it.

## Authentication and transport
Emulator: no credentials. Google Cloud: an OAuth **access token** pasted into the connection (for example `gcloud auth print-access-token`; it expires after about an hour). A **Google credentials file** can be used instead (field, `GOOGLE_APPLICATION_CREDENTIALS`, or the file `gcloud auth application-default login` writes): a service-account key or an authorized-user file. RizomaDB then asks Google's token endpoint (`token_uri` of the file, HTTPS only) for short-lived tokens by itself and renews them; nothing is written to disk. This is a request the extension makes on your behalf, only when you connect to Google Cloud. Workload identity, the GCE/Cloud Run metadata server and external-account files are **not** supported. The token exchange is tested against a local stand-in for the token endpoint (the signed assertion is verified with the public key), **not against Google**.

## Capabilities
A JSON console (runs in the JSON editor mode): `{ "from": "users", "where": [["age", ">=", 18]], "orderBy": [["age", "desc"]], "limit": 20, "select": ["name"] }`, `{ "collectionGroup": "posts" }`, `{ "get": "users/alice" }`, `{ "collections": "users/alice" }`, `{ "set": "users/alice", "data": {...} }`, `{ "update": "users/alice", "data": {...} }` (merge, document must exist), `{ "delete": "users/alice" }`. Operators: `== != < <= > >= in not-in array-contains array-contains-any`. Comments and trailing commas are allowed.

## Type notes
Special values in `data`/filters: `{"$timestamp": "ISO"}`, `{"$ref": "users/alice"}`, `{"$bytes": "base64"}`, `{"$geo": [lat, lng]}`, `{"$int": "9007199254740993"}` (a bare JSON number is rounded by JSON.parse before it is sent). Integers come back exact; maps and arrays are JSON. Documents are schemaless: columns are the union of fields of the returned documents, plus `__name__` (the document path).

## Limits (honest)
- Results are not streamed: a query returns at most `limit` (or `maxRows`, or 10,000) documents. Every document read is **billed** on Google Cloud.
- No transactions, batched writes, listeners, aggregation queries, vector search, security-rules tooling or index management; composite-index errors from the server are shown as syntax errors.
- Deleting a document does not delete its sub-collections.
- No pagination cursors yet.

## Read-only enforcement
Client-side: only `from`/`collectionGroup`/`get`/`collections` run on a read-only connection (default-deny, unparsable input counts as a write). For a server-side guarantee use an IAM role with read access only.

## External tools
none

## Driver license
none (built on node:http)

## Running the integration tests
`docker compose -f test/compose/docker-compose.yml up -d firestore` then `pnpm --filter @rizomadb/driver-firestore test` (port 18080, project `rizoma-test`; override with `RZ_FIRESTORE_PORT`).
