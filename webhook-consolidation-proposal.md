# Webhook Logic Consolidation Proposal

## Current State

The webhook logic is currently scattered across multiple locations:

### 1. **apps/provisioning/pkg/repository/github/webhook.go**
- `OnCreate()` - Creates webhook on GitHub, patches `/status/webhook` and `/secure/webhookSecret`
- `OnUpdate()` - Updates webhook if needed, patches status directly
- `OnDelete()` - Deletes webhook from GitHub
- **Issues**: Direct status patching, mixed concerns (GitHub API + status management)

### 2. **pkg/registry/apis/provisioning/webhooks/webhook.go**
- `updateLastEvent()` - Updates `/status/webhook/lastEvent` when webhook is triggered
- **Issues**: Another direct status patch in a different file

### 3. **apps/provisioning/pkg/repository/secure.go**
- Handles webhook secret retrieval
- Clean, no issues here

## Problems with Current Approach ("hacks")

1. **Scattered logic**: Webhook state management happens in 3+ different files
2. **Direct status patches**: Bypasses any condition tracking or observability
3. **No failure tracking**: If webhook creation fails, no condition tracks it
4. **No secret status**: Can't tell if webhook secret is ready/pending/failed
5. **Inconsistent with k8s patterns**: Should use conditions for state tracking

## Proposed Consolidated Approach

### Option A: Webhook Setup in Controller (Recommended)

Move webhook setup/update logic from repository hooks to the controller reconciliation loop:

**pkg/registry/apis/provisioning/controller/webhooks.go** (NEW FILE)
```go
// updateWebhookConfiguredCondition handles webhook setup and condition tracking
func (rc *RepositoryController) updateWebhookConfiguredCondition(
    ctx context.Context,
    obj *provisioning.Repository,
    repo repository.Repository,
) []map[string]interface{} {
    // Skip if webhooks not enabled or no webhook URL
    if !rc.webhooksEnabled || obj.Spec.WebhookURL == "" {
        return buildConditionPatchOps(obj, metav1.Condition{
            Type:   provisioning.ConditionTypeWebhookConfigured,
            Status: metav1.ConditionTrue,
            Reason: provisioning.ReasonWebhookNotRequired,
            Message: "Webhook is not required for this repository",
        })
    }

    // Check if webhook secret is ready (depends on SecretsConfigured condition)
    if !isWebhookSecretReady(obj) {
        return buildConditionPatchOps(obj, metav1.Condition{
            Type:   provisioning.ConditionTypeWebhookConfigured,
            Status: metav1.ConditionFalse,
            Reason: provisioning.ReasonSecretNotReady,
            Message: "Waiting for webhook secret",
        })
    }

    // Setup/update webhook with provider (GitHub, etc.)
    webhookStatus, err := setupWebhook(ctx, repo, obj)
    if err != nil {
        return []map[string]interface{}{
            buildConditionPatchOps(obj, metav1.Condition{
                Type:   provisioning.ConditionTypeWebhookConfigured,
                Status: metav1.ConditionFalse,
                Reason: provisioning.ReasonWebhookFailed,
                Message: err.Error(),
            })[0],
            // Keep webhook status patch for data
            {
                "op": "replace",
                "path": "/status/webhook",
                "value": webhookStatus,
            },
        }...
    }

    return []map[string]interface{}{
        buildConditionPatchOps(obj, metav1.Condition{
            Type:   provisioning.ConditionTypeWebhookConfigured,
            Status: metav1.ConditionTrue,
            Reason: provisioning.ReasonWebhookCreated,
            Message: fmt.Sprintf("Webhook configured at %s", webhookStatus.URL),
        })[0],
        {
            "op": "replace",
            "path": "/status/webhook",
            "value": webhookStatus,
        },
    }...
}
```

**Controller reconciliation order**:
1. Validation
2. Secrets setup (token, webhook secret)
3. Health check
4. **Webhook setup** (NEW - depends on secrets)
5. Sync
6. Update conditions (including WebhookConfigured)

### Option B: Keep in Repository Hooks + Add Condition Tracking

Keep webhook setup in repository hooks but add condition tracking in controller:

**pros**: Less refactoring, maintains current separation
**cons**: Still scattered, harder to understand flow

## Recommendation

**Use Option A** for these reasons:
1. All reconciliation logic in one place (controller)
2. Clear dependency chain: Secrets → Webhook → Sync
3. Proper condition tracking from the start
4. Easier to test and debug
5. Consistent with k8s controller patterns

## Implementation Steps

1. Create `controller/webhooks.go` with:
   - `updateWebhookConfiguredCondition()`
   - `setupWebhook()` helper
   - `deleteWebhook()` helper
   - Move webhook creation/update logic from repository hooks

2. Update `controller/repository.go`:
   - Add webhook condition update to reconciliation
   - Order: after secrets, before sync

3. Update `github/webhook.go`:
   - Remove `OnCreate`/`OnUpdate` webhook setup
   - Keep `OnDelete` for cleanup
   - Keep webhook handler (`Webhook()` method)

4. Update `webhooks/webhook.go`:
   - Keep handler logic
   - Remove direct `updateLastEvent` status patch
   - Track lastEvent in condition message instead

5. Add tests in `controller/webhooks_test.go`

## Questions for Review

1. Should we keep the `/status/webhook` field for backward compatibility, or rely only on conditions?
2. Should `lastEvent` tracking use a condition or stay as a direct status field?
3. Should webhook setup happen on every reconciliation or only when conditions change?

