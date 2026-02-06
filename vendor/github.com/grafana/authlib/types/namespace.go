package types

import (
	"fmt"
	"strconv"
	"strings"
)

// NamespaceFormatter defines a function that formats a stack or organization ID
// into the expected namespace format based on the deployment environment (Cloud/On-prem).
// Example: stacks-6481, org-12
type NamespaceFormatter func(int64) string

func CloudNamespaceFormatter(id int64) string {
	return fmt.Sprintf("stacks-%d", id)
}

// OrgNamespaceFormatter is the namespace format used in on-prem deployments
func OrgNamespaceFormatter(id int64) string {
	if id == 1 {
		return "default"
	}
	return fmt.Sprintf("org-%d", id)
}

// NamespaceMatches check if provided namespace matches the expected one.
// This function always cosider the namespace to match if namespace is `*`.
func NamespaceMatches(namespace, expected string) bool {
	if namespace == "*" {
		return true
	}

	// We should only be able to work with cluster scoped resources or across several namespaces if
	// caller has `*`
	if expected == "" {
		return false
	}

	return namespace == expected
}

type NamespaceInfo struct {
	// The original namespace string regardless the input
	Value string

	// OrgID defined in namespace (1 when using stack ids)
	OrgID int64

	// The cloud stack ID (must match the value in cfg.Settings)
	StackID int64
}

func ParseNamespace(ns string) (NamespaceInfo, error) {
	info := NamespaceInfo{Value: ns, OrgID: -1}
	if ns == "default" {
		info.OrgID = 1
		return info, nil
	}

	if id, ok := strings.CutPrefix(ns, "org-"); ok {
		orgID, err := strconv.ParseInt(id, 10, 64)
		if err != nil {
			return info, fmt.Errorf("invalid org id")
		}

		if orgID < 1 {
			return info, fmt.Errorf("invalid org id")
		}
		if orgID == 1 {
			return info, fmt.Errorf("use default rather than org-1")
		}
		info.OrgID = orgID
		return info, err
	}

	if id, ok := strings.CutPrefix(ns, "stacks-"); ok {
		stackID, err := strconv.ParseInt(id, 10, 64)
		if err != nil || stackID < 1 {
			return info, fmt.Errorf("invalid stack id")
		}
		info.StackID = stackID
		info.OrgID = 1
		return info, err
	}

	return info, nil
}
