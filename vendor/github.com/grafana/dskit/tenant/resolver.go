package tenant

import (
	"context"
	"strings"

	"github.com/grafana/dskit/user"
)

// TenantID returns exactly a single tenant ID from the context. It should be
// used when a certain endpoint should only support exactly a single
// tenant ID. It returns an error user.ErrNoOrgID if there is no tenant ID
// supplied or user.ErrTooManyOrgIDs if there are multiple tenant IDs present.
//
// ignore stutter warning
//
//nolint:revive
func TenantID(ctx context.Context) (string, error) {
	//lint:ignore faillint wrapper around upstream method
	orgID, err := user.ExtractOrgID(ctx)
	if err != nil {
		return "", err
	}
	if !strings.Contains(orgID, tenantIDsSeparator) {
		if err := ValidTenantID(orgID); err != nil {
			return "", err
		}
		return orgID, nil
	}
	orgIDs, err := tenantIDsFromString(orgID)
	if err != nil {
		return "", err
	}

	if len(orgIDs) > 1 {
		return "", user.ErrTooManyOrgIDs
	}

	return orgIDs[0], nil
}

// TenantIDs returns all tenant IDs from the context. It should return
// normalized list of ordered and distinct tenant IDs (as produced by
// NormalizeTenantIDs).
//
// ignore stutter warning
//
//nolint:revive
func TenantIDs(ctx context.Context) ([]string, error) {
	//lint:ignore faillint wrapper around upstream method
	orgID, err := user.ExtractOrgID(ctx)
	if err != nil {
		return nil, err
	}

	return tenantIDsFromString(orgID)
}

func tenantIDsFromString(orgID string) ([]string, error) {
	orgIDs := strings.Split(orgID, tenantIDsSeparator)
	for _, id := range orgIDs {
		if err := ValidTenantID(id); err != nil {
			return nil, err
		}
	}

	return NormalizeTenantIDs(orgIDs), nil
}

type Resolver interface {
	// TenantID returns exactly a single tenant ID from the context. It should be
	// used when a certain endpoint should only support exactly a single
	// tenant ID. It returns an error user.ErrNoOrgID if there is no tenant ID
	// supplied or user.ErrTooManyOrgIDs if there are multiple tenant IDs present.
	TenantID(context.Context) (string, error)

	// TenantIDs returns all tenant IDs from the context. It should return
	// normalized list of ordered and distinct tenant IDs (as produced by
	// NormalizeTenantIDs).
	TenantIDs(context.Context) ([]string, error)
}

type MultiResolver struct{}

// NewMultiResolver creates a tenant resolver, which allows request to have
// multiple tenant ids submitted separated by a '|' character. This enforces
// further limits on the character set allowed within tenants as detailed here:
// https://grafana.com/docs/mimir/latest/configure/about-tenant-ids/
func NewMultiResolver() *MultiResolver {
	return &MultiResolver{}
}

func (t *MultiResolver) TenantID(ctx context.Context) (string, error) {
	return TenantID(ctx)
}

func (t *MultiResolver) TenantIDs(ctx context.Context) ([]string, error) {
	return TenantIDs(ctx)
}
