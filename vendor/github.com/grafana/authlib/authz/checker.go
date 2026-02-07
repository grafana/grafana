package authz

var (
	noAccessChecker   Checker = func(resources ...Resource) bool { return false }
	fullAccessChecker Checker = func(resources ...Resource) bool { return true }
)

// compileChecker generates a function to check whether the user has access to any scope of a given list of scopes.
func compileChecker(permissions permissions, action string, kinds ...string) Checker {
	// no permissions => no access to any resource of this type
	if len(permissions) == 0 {
		return noAccessChecker
	}

	// no permissions for this action => no access to any resource of this type
	pScopes, ok := permissions[action]
	if !ok {
		return noAccessChecker
	}

	// no prefix expected => only check for the action
	if len(kinds) == 0 {
		return fullAccessChecker
	}

	isWildcard := wildcardDetector(kinds...)
	lookup := make(map[string]bool, len(pScopes))
	for _, s := range pScopes {
		// one scope is a wildcard => access to all resources of this type
		if isWildcard(s) {
			return fullAccessChecker
		}
		lookup[s] = true
	}

	return func(resources ...Resource) bool {
		// search for any direct match
		for i := range resources {
			if lookup[resources[i].Scope()] {
				return true
			}
		}
		return false
	}
}

// wildcardDetector is an helper to quickly assess if a scope is a wildcard of a given set of kinds.
// ex: wildcardDetector("datasources", "folders")("datasources:uid:*") => true
func wildcardDetector(kinds ...string) func(scope string) bool {
	// no kinds => no wildcard
	if len(kinds) == 0 {
		return func(scope string) bool { return false }
	}
	return func(scope string) bool {
		// split the scope into its parts
		kind, _, id := splitScope(scope)
		for i := range kinds {
			if (kind == kinds[i] || kind == "*") && id == "*" {
				return true
			}
		}
		return false
	}
}
