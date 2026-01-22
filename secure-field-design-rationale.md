# CRD Secure Field Design Rationale

## Decision: Keep the top-level `secure` field

## Summary

The Connection and Repository CRDs use a top-level `secure` field (alongside `spec` and `status`) to manage both user-provided and system-generated secrets. While unconventional, this design is the correct choice for our use case.

## Why This Design Is Right

### 1. Secrets Are Neither Spec Nor Status

**Spec** = Desired state (what the user wants)
**Status** = Observed state (what the system observes)
**Secure** = Sensitive configuration data (hybrid: user-provided + system-generated)

System-generated tokens (like repository tokens from connections) are not "desired state" that users declare - they're runtime secrets the controller creates and manages. Putting them in `spec` violates Kubernetes principles and creates reconciliation noise.

### 2. Unified Secret Lifecycle

All secrets (user-provided credentials + system-generated tokens) share the same lifecycle:
- Created and stored using the same encryption service
- Referenced using the same `InlineSecureValue` type (create/name/remove)
- Bound to the CRD's existence (no orphaned secrets)
- Accessed through the same decryption mechanism

Splitting secrets across `spec` and `status` would create two code paths, confusing which secrets live where.

### 3. Better Than Alternatives

**Separate Secret Resources**: Much more complex, requires managing lifecycle of multiple resources, harder discovery, breaks atomicity of CRD definition.

**Spec + Status Split**: Violates "spec is desired state" principle, creates reconciliation loops when system patches spec, GitOps unfriendly (generated values pollute spec diffs).

**Spec Only**: Same problems as above, plus muddles the distinction between what users provide vs. what the system generates.

### 4. Precedent Exists

Kubernetes itself uses non-spec/status fields when semantically appropriate:
- ConfigMap/Secret use `data` (not `spec.data`)
- Our case: `secure` is configuration data with special security requirements

### 5. Our Implementation Is Already Sound

- `InlineSecureValue` union type (create/name/remove) provides clean API
- Admission controllers preserve secrets during updates
- Raw values never exposed (marshaling redacts them)
- References stored in CRD, encrypted values in secret service
- Token expiration tracked in status for lifecycle management

## What Makes This Feel "Messy"

The perceived messiness comes from:
1. Controllers patching a field that's not status (unusual but valid)
2. Hybrid nature (user + system data in same field)
3. Unfamiliarity (most CRDs only have spec/status)

None of these are actual problems - they're characteristics of solving a genuinely complex problem: managing secrets with mixed ownership and shared lifecycle.

## Conclusion

The top-level `secure` field is:
- **Semantically correct**: Secrets aren't desired/observed state
- **Practically superior**: Single lifecycle, unified handling, simpler than alternatives
- **Architecturally sound**: Clear separation from spec/status, proper security model

This design should be maintained. The "messiness" is not a flaw - it's the appropriate complexity for the problem being solved.

## Documentation Recommendation

Add clear comments in the CRD type definitions explaining why `secure` is top-level, referencing this rationale for future maintainers.
