# Security Audit: Authorization & API Vulnerability Findings

**Scope**: Recently added/modified Grafana code, focusing on areas NOT covered by existing findings.  
**Areas examined**: API endpoint auth gaps, snapshot security, collections API, secret service.

---

## Finding 1: Snapshot K8s Authorizer Unconditionally Allows Anonymous GET (Including Dashboard Data)

**Severity**: Medium  
**File**: `pkg/registry/apis/dashboard/snapshot/authorizer.go`, lines 23–27  

### Evidence

```go
// Allow anonymous GET on snapshots and the dashboard subresource (public viewing).
verb := attr.GetVerb()
sub := attr.GetSubresource()
if verb == "get" && (sub == "" || sub == "dashboard") {
    return authorizer.DecisionAllow, "", nil
}
```

### Description

The K8s snapshot authorizer unconditionally allows anonymous/unauthenticated GET requests for any snapshot and its `dashboard` subresource. The comment says it "mirrors legacy SnapshotPublicMode behavior," but **it does NOT check whether `SnapshotPublicMode` is actually enabled**. The `SnapshotSharingOptions` struct (which carries `PublicMode`) is not passed to the authorizer at all.

This is consistent with the legacy `GET /api/snapshots/:key` endpoint at `pkg/api/api.go:605`, which also has no auth middleware — snapshots are viewable by anyone who knows the key. However, there is an important behavioral difference in the K8s API:

- The K8s **LIST** verb at lines 82–83 maps to `ActionSnapshotsRead` and requires RBAC — so unauthenticated users cannot enumerate snapshots.
- But the K8s **GET** verb for individual snapshots (with known name) and their **dashboard** subresource (full dashboard JSON) bypasses all RBAC checks.

### Attack Path

1. An attacker who obtains or guesses a snapshot name can access `GET /apis/dashboard.grafana.app/v0alpha1/namespaces/{ns}/snapshots/{name}` without authentication.
2. More critically, the `dashboard` subresource (`GET .../snapshots/{name}/dashboard`) returns the full embedded dashboard JSON, which may contain sensitive panel data, query configurations, or data source references.

### Assessment

This is likely **by design** for public snapshot sharing (the key IS the authentication), but the lack of any `PublicMode` guard means even instances with `public_mode = false` allow anonymous GET on the K8s API. This is functionally equivalent to legacy behavior, so the risk is accepted if snapshot keys are treated as secrets.

---

## Finding 2: `dashboard-solo/snapshot/*` Route Has No Auth Middleware

**Severity**: Low (Frontend view route only)  
**File**: `pkg/api/api.go`, line 186  

### Evidence

```go
r.Get("/dashboard-solo/snapshot/*", hs.Index)
```

### Description

This route registration has no auth middleware at all — no `reqSignedIn`, no `reqNoAuth`, no `authorize()`. Every other `dashboard-solo/*` route requires `reqSignedIn` (lines 188–190). The `hs.Index` handler serves the React SPA shell.

By comparison, `r.Get("/dashboard/snapshot/*", reqNoAuth, hs.Index)` at line 258 explicitly uses `reqNoAuth` (which handles the `forceLogin` redirect). The solo snapshot route does NOT even have this minimal protection.

### Attack Path

Without `reqNoAuth`, when `force_login = true` is configured in `auth.ini`, unauthenticated users won't be redirected to the login page for this specific route. The SPA shell is served regardless, though the actual dashboard data would still need to be fetched via the snapshot API (which is also unauthenticated for GET). This is a minor inconsistency rather than a critical bypass.

---

## Finding 3: Collections API Missing `AccessClient` — Potential Nil Dereference on Team Resources

**Severity**: Low (Collections only supports `UserResourceOwner` currently)  
**File**: `pkg/registry/apis/collections/register.go`, lines 50–56  
**Related**: `pkg/registry/apis/preferences/utils/authorizer.go`, lines 92–111  

### Evidence

Collections registration:
```go
authorizer: &utils.AuthorizeFromName{
    AllowOrgAdmin: true,
    Resource: map[string][]utils.ResourceOwner{
        "stars": {utils.UserResourceOwner},
    },
    // AccessClient is nil (not set)
},
```

Authorizer team check (lines 98–104):
```go
case TeamResourceOwner:
    // ...
    rsp, err := a.AccessClient.Check(ctx, user, authlib.CheckRequest{...}, "")
```

### Description

The collections API's `AuthorizeFromName` authorizer is initialized without an `AccessClient`. If the resource owner list were ever expanded to include `TeamResourceOwner`, any team-based authorization check would dereference a nil `AccessClient`, causing a panic.

Currently, this is safe because the collections API only registers `UserResourceOwner` for the "stars" resource. The `ParseOwnerFromName` function would need to return a `TeamResourceOwner` for a name like `team-xxx`, and `slices.Contains(owners, TeamResourceOwner)` would fail before reaching the nil dereference because `owners` only contains `UserResourceOwner`.

However, this is a latent defect: adding `TeamResourceOwner` to the collections resource map without also providing an `AccessClient` would create a crash vulnerability. The preferences API correctly provides `AccessClient` (line 55 of `preferences/register.go`).

---

## Finding 4: `AuthorizeFromName` Allows All Requests for `UnknownResourceOwner`

**Severity**: Medium  
**File**: `pkg/registry/apis/preferences/utils/authorizer.go`, lines 113–114  

### Evidence

```go
case UnknownResourceOwner:
    return authorizer.DecisionAllow, "", nil
```

### Description

The `AuthorizeFromName` authorizer has a catch-all case for `UnknownResourceOwner` (empty string `""`) that unconditionally allows the request. `UnknownResourceOwner` is returned by `ParseOwnerFromName` when the resource name doesn't match `user-*`, `team-*`, or `namespace` patterns.

**Current mitigations**: The check at lines 70–73 prevents this case from being reached for most APIs:

```go
info, _ := ParseOwnerFromName(attr.GetName())
if !slices.Contains(owners, info.Owner) {
    return authorizer.DecisionDeny, "unsupported owner type", nil
}
```

Since neither the collections nor preferences APIs include `UnknownResourceOwner` in their `owners` lists, the deny at line 72 triggers first. However:

1. The preferences API allows "merged" as a special `OKNames` entry (line 54 of `preferences/register.go`), which bypasses the owner check entirely.
2. If any future API registers `UnknownResourceOwner` in its `owners` list (or adds arbitrary names to `OKNames`), any authenticated user would get full access.

This is a defense-in-depth concern: the `UnknownResourceOwner` allow-all case is dangerous code that could be activated by a seemingly innocuous configuration change.

---

## Finding 5: Snapshot `ExternalDeleteURL` Stored from User-Influenced Context (Stored SSRF Variant)

**Severity**: Low–Medium (Requires admin-level config, but attack is persistent)  
**File**: `pkg/registry/apis/dashboard/snapshot/snapshot_legacy_store.go`, lines 69–84  
**Also**: `pkg/registry/apis/dashboard/snapshot/storage_without_create.go`, lines 99–115  

### Evidence

Legacy store delete (lines 69–84):
```go
if snap.ExternalDeleteURL != "" {
    if openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagExternalSnapshotsK8SAPIPush, false, openfeature.TransactionContext(ctx)) {
        parsed, err := url.Parse(snap.ExternalDeleteURL)
        // ...
        deleteURL := parsed.Scheme + "://" + parsed.Host + "/apis/..."
        if err := deleteExternalSnapshot(deleteURL, s.ExternalSnapshotToken); err != nil {
```

### Description

When deleting an external snapshot, the code reads the `ExternalDeleteURL` from the stored snapshot record and makes an HTTP request to it. The URL is originally derived from the admin-configured `ExternalSnapshotURL`, but the stored `ExternalDeleteURL` could potentially be modified if there's a data integrity issue or if the legacy database is compromised.

More notably, the `deleteExternalSnapshotLegacy` function at `storage_without_create.go:188` uses the URL from the database almost directly, with only a scheme/host extraction as sanitization. The `ExternalSnapshotToken` (bearer token) is sent along with DELETE requests — so if the stored URL were tampered with, the bearer token could be exfiltrated to an attacker-controlled server.

The risk is mitigated by:
1. The URL originates from admin-only config (`external_snapshot_url` in `snapshots.ini`)
2. URL parsing validates scheme and host before use
3. Write access to the snapshot database requires prior authorization

---

## Finding 6: Secret Decrypt `NoopAlwaysAllowedAuthorizer` Exists as Production Code

**Severity**: Informational  
**File**: `pkg/registry/apis/secret/decrypt/noop_authorizer.go`  

### Evidence

```go
type NoopAlwaysAllowedAuthorizer struct{}

func (a *NoopAlwaysAllowedAuthorizer) Authorize(context.Context, xkube.Namespace, string, []string, []metav1.OwnerReference) (string, bool, string) {
    return "", true, ""
}
```

### Description

A no-op decrypt authorizer exists that always returns `allowed=true`, bypassing all decrypt authorization checks. While currently only referenced in its own file (no production usage found via grep), this remains available as a production-ready implementation that could be accidentally wired in via dependency injection.

The real `decryptAuthorizer` in `authorizer.go` correctly validates namespace matching, service identity, token permissions, and decrypter allowlists. The noop variant is likely intended for testing, but its presence in production code (not in a `_test.go` file or `testutils/` package) is a risk.

---

## Summary

| # | Finding | Severity | Risk |
|---|---------|----------|------|
| 1 | Snapshot K8s authorizer allows anonymous GET regardless of PublicMode config | Medium | Dashboard data accessible to anyone with snapshot name |
| 2 | `dashboard-solo/snapshot/*` route missing auth middleware | Low | Inconsistent auth enforcement on frontend route |
| 3 | Collections API missing `AccessClient` — latent nil-deref on team resources | Low | Currently safe, but brittle for future changes |
| 4 | `AuthorizeFromName` allows all for `UnknownResourceOwner` | Medium | Defense-in-depth gap; could be activated by config changes |
| 5 | Stored `ExternalDeleteURL` used for HTTP requests with bearer token | Low–Medium | Token exfiltration if stored URL is tampered |
| 6 | Noop decrypt authorizer in production code | Informational | Could be accidentally wired in |
