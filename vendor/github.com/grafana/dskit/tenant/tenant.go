package tenant

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/grafana/dskit/user"
)

const (
	// MaxTenantIDLength is the max length of single tenant ID in bytes
	MaxTenantIDLength = 150

	tenantIDsSeparator = "|"
)

var (
	errTenantIDTooLong = fmt.Errorf("tenant ID is too long: max %d characters", MaxTenantIDLength)
	errUnsafeTenantID  = errors.New("tenant ID is '.' or '..'")
)

type errTenantIDUnsupportedCharacter struct {
	pos      int
	tenantID string
}

func (e *errTenantIDUnsupportedCharacter) Error() string {
	return fmt.Sprintf(
		"tenant ID '%s' contains unsupported character '%c'",
		e.tenantID,
		e.tenantID[e.pos],
	)
}

// NormalizeTenantIDs creates a normalized form by sorting and de-duplicating the list of tenantIDs
func NormalizeTenantIDs(tenantIDs []string) []string {
	sort.Strings(tenantIDs)

	count := len(tenantIDs)
	if count <= 1 {
		return tenantIDs
	}

	posOut := 1
	for posIn := 1; posIn < count; posIn++ {
		if tenantIDs[posIn] != tenantIDs[posIn-1] {
			tenantIDs[posOut] = tenantIDs[posIn]
			posOut++
		}
	}

	return tenantIDs[0:posOut]
}

// ValidTenantID returns an error if the single tenant ID is invalid, nil otherwise
func ValidTenantID(s string) error {
	// check if it contains invalid runes
	for pos, r := range s {
		if !isSupported(r) {
			return &errTenantIDUnsupportedCharacter{
				tenantID: s,
				pos:      pos,
			}
		}
	}

	if len(s) > MaxTenantIDLength {
		return errTenantIDTooLong
	}

	if containsUnsafePathSegments(s) {
		return errUnsafeTenantID
	}

	return nil
}

// JoinTenantIDs returns all tenant IDs concatenated with the separator character `|`
func JoinTenantIDs(tenantIDs []string) string {
	return strings.Join(tenantIDs, tenantIDsSeparator)
}

// ExtractTenantIDFromHTTPRequest extracts a single tenant ID directly from a HTTP request.
func ExtractTenantIDFromHTTPRequest(req *http.Request) (string, context.Context, error) {
	//lint:ignore faillint wrapper around upstream method
	_, ctx, err := user.ExtractOrgIDFromHTTPRequest(req)
	if err != nil {
		return "", nil, err
	}

	tenantID, err := TenantID(ctx)
	if err != nil {
		return "", nil, err
	}

	return tenantID, ctx, nil
}

// TenantIDsFromOrgID extracts different tenants from an orgID string value
//
// ignore stutter warning
//
//nolint:revive
func TenantIDsFromOrgID(orgID string) ([]string, error) {
	return TenantIDs(user.InjectOrgID(context.TODO(), orgID))
}

// this checks if a rune is supported in tenant IDs (according to
// https://grafana.com/docs/mimir/latest/configure/about-tenant-ids/
func isSupported(c rune) bool {
	// characters
	if ('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z') {
		return true
	}

	// digits
	if '0' <= c && c <= '9' {
		return true
	}

	// special
	return c == '!' ||
		c == '-' ||
		c == '_' ||
		c == '.' ||
		c == '*' ||
		c == '\'' ||
		c == '(' ||
		c == ')'
}

// containsUnsafePathSegments will return true if the string is a directory
// reference like `.` and `..`
func containsUnsafePathSegments(id string) bool {
	return id == "." || id == ".."
}
