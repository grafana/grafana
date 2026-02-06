package authz

import (
	"slices"
	"strings"

	"github.com/grafana/authlib/types"
)

// ServiceEvaluationResult contains the result of a service permission check along with debug information
type ServiceEvaluationResult struct {
	// ServiceCall indicates if the call was made by a service (access policy) identity
	// False indicates an on-behalf-of call (delegated permissions), user permissions should be checked.
	ServiceCall bool
	// Allowed indicates if the permission check passed. This does not imply that the user is allowed,
	// only that the service has the required permissions (itself or acting on behalf of a user)
	// If false, the caller should reject the request immediately.
	// If true, the caller can proceed to check user permissions as needed.
	Allowed bool
	// Permissions lists the permissions present in the token used for the check
	Permissions []string
}

// TL;DR: CheckServicePermissions should only be used when user permissions are checked later in the flow.
// If the service is allowed, the caller can proceed to check user permissions as needed.
// If the service is not allowed, the caller should reject the request immediately.
// Prefer using the authz.Client directly, it handles both service and user permissions in one call.
//
// AuthInfo always holds service info, and optionally user info (service vs. on-behalf-of calls).
// While service permissions are directly checkable from AuthInfo, user permissions require an AuthZ service
// call which is not done here.
//
// CheckServicePermissions verifies if the service has the required permissions for an action:
// - For direct service calls (access policy), it checks the service's own permissions.
// - For calls made on behalf of a user (on-behalf-of), it checks the service's delegated permissions.
func CheckServicePermissions(authInfo types.AuthInfo, group, resource, verb string) ServiceEvaluationResult {
	res := ServiceEvaluationResult{
		ServiceCall: types.IsIdentityType(authInfo.GetIdentityType(), types.TypeAccessPolicy),
	}
	if res.ServiceCall {
		res.Permissions = authInfo.GetTokenPermissions()
	} else {
		res.Permissions = authInfo.GetTokenDelegatedPermissions()
	}
	res.Allowed = hasPermissionInToken(res.Permissions, group, resource, verb)
	return res
}

// allowedWildcardGroups are the only permission groups that may use wildcard matching; all others require exact match.
var allowedWildcardGroups = []string{
	"*.datasource.grafana.app",
}

// check wildcard group matching as well as exact match
func groupMatches(permissionGroup, requestGroup string) bool {
	// if granted permission is a wildcard, it must be allowlisted and the request must match
	if strings.HasPrefix(permissionGroup, "*.") {
		if !slices.Contains(allowedWildcardGroups, permissionGroup) {
			return false
		}
		suffix := permissionGroup[1:]                                // remove leading "*"
		prefixSegment, ok := strings.CutSuffix(requestGroup, suffix) // e.g. "prometheus.datasource.grafana.app" -> "prometheus"
		if !ok || len(prefixSegment) == 0 {
			return false
		}
		// the prefix segment must not contain any dots (e.g. "prometheus" is allowed, "prometheus.bad" is not)
		return !strings.Contains(prefixSegment, ".")
	}
	// otherwise, exact match is required
	return permissionGroup == requestGroup
}

func hasPermissionInToken(tokenPermissions []string, group, resource, verb string) bool {
	verbs := []string{verb}

	// we always map list to get for authz
	// to be backward compatible with access tokens we accept both for now
	if verb == "list" {
		verbs = append(verbs, "get")
	}

	for _, p := range tokenPermissions {
		parts := strings.SplitN(p, ":", 2)
		if len(parts) != 2 {
			continue
		}
		pVerb := parts[1]
		if pVerb != "*" && !slices.Contains(verbs, pVerb) {
			continue
		}

		parts = strings.SplitN(parts[0], "/", 2)
		switch len(parts) {
		case 1:
			if groupMatches(parts[0], group) {
				return true
			}
		case 2:
			if groupMatches(parts[0], group) && parts[1] == resource {
				return true
			}
		}
	}
	return false
}
