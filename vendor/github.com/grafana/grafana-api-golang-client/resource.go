package gapi

import (
	"fmt"
	"strconv"
)

const (
	DashboardsResource      = "dashboards"
	DatasourcesResource     = "datasources"
	FoldersResource         = "folders"
	ServiceAccountsResource = "serviceaccounts"
	TeamsResource           = "teams"
	UsersResource           = "users"
	BuiltInRolesResource    = "builtInRoles"
)

// ResourceIdent represents anything that can be considered a resource identifier.
type ResourceIdent interface {
	fmt.Stringer
}

// ResourceID wraps `int64` to be a valid `ResourceIdent`
type ResourceID int64

func (id ResourceID) String() string {
	return strconv.FormatInt(int64(id), 10)
}

// ResourceUID wraps `string` to be a valid `ResourceIdent`
type ResourceUID string

func (id ResourceUID) String() string {
	return string(id)
}
