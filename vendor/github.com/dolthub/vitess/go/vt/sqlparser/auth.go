// Copyright 2024 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sqlparser

import "fmt"

// AuthNode is a node that contains AuthInformation.
type AuthNode interface {
	// GetAuthInformation returns the AuthInformation contained on this node.
	GetAuthInformation() AuthInformation
	// SetAuthType sets the AuthType field, overwriting an existing value if one was already set.
	SetAuthType(authType string)
	// SetAuthTargetType sets the TargetType field, overwriting an existing value if one was already set.
	SetAuthTargetType(targetType string)
	// SetAuthTargetNames sets the TargetNames field, overwriting an existing value if one was already set. It is
	// assumed that the given slice will not be modified, therefore implementors of the interface can simply use the
	// given slice without creating a copy.
	SetAuthTargetNames(targetNames []string)
	// SetExtra sets the Extra field, overwriting an existing value if one was already set.
	SetExtra(extra any)
}

// AuthInformation contains authorization information that is relevant to the node that this is embedded in. Such
// information will be used to determine, for example, whether a user has the correct permissions to execute the
// command. All information that could possibly be related to authorization should be stored here, rather than on the
// node. This allows for integrators to consolidate their authorization logic.
type AuthInformation struct {
	// This allows for additional information to be added, which is completely up to the integrator.
	Extra any
	// This specifies the authorization "type". For example, a node representing a table query may use the "SELECT"
	// type, while one that updates a table may use the "UPDATE" type. It is intended that these will relatively match
	// the SQL statements that generated the node, however it is up to the integrator to interpret this field's use.
	AuthType string
	// This is the target of the authorization, which is dependent on the AuthType. It could be a table, function, etc.
	TargetType string
	// These are the names of the targets. For example, if the TargetType represents a table, then this could be the
	// database and table name. It could also represent multiple table names, depending on the value of TargetType.
	TargetNames []string
}

// These AuthType_ enums are used as the AuthType in AuthInformation. However, these are only built-in suggestions that
// will be used from the accompanying parser. Integrators may produce nodes through other means, therefore these are
// only relevant for the parser's MySQL dialect.
const (
	AuthType_IGNORE                = "IGNORE"
	AuthType_ALTER                 = "ALTER"
	AuthType_ALTER_ROUTINE         = "ALTER_ROUTINE"
	AuthType_ALTER_USER            = "ALTER_USER"
	AuthType_CALL                  = "CALL"
	AuthType_CREATE                = "CREATE"
	AuthType_CREATE_ROLE           = "CREATE_ROLE"
	AuthType_CREATE_ROUTINE        = "CREATE_ROUTINE"
	AuthType_CREATE_TEMP           = "CREATE_TEMP"
	AuthType_CREATE_USER           = "CREATE_USER"
	AuthType_CREATE_VIEW           = "CREATE_VIEW"
	AuthType_DELETE                = "DELETE"
	AuthType_DROP                  = "DROP"
	AuthType_DROP_ROLE             = "DROP_ROLE"
	AuthType_EVENT                 = "EVENT"
	AuthType_FILE                  = "FILE"
	AuthType_FOREIGN_KEY           = "FOREIGN_KEY"
	AuthType_GRANT_PRIVILEGE       = "GRANT_PRIVILEGE"
	AuthType_GRANT_PROXY           = "GRANT_PROXY"
	AuthType_GRANT_ROLE            = "GRANT_ROLE"
	AuthType_INDEX                 = "INDEX"
	AuthType_INSERT                = "INSERT"
	AuthType_LOCK                  = "LOCK"
	AuthType_PROCESS               = "PROCESS"
	AuthType_RELOAD                = "RELOAD"
	AuthType_RENAME                = "RENAME"
	AuthType_REPLACE               = "REPLACE"
	AuthType_REPLICATION           = "REPLICATION"
	AuthType_REPLICATION_CLIENT    = "REPLICATION_CLIENT"
	AuthType_REVOKE_ALL            = "REVOKE_ALL"
	AuthType_REVOKE_PRIVILEGE      = "REVOKE_PRIVILEGE"
	AuthType_REVOKE_PROXY          = "REVOKE_PROXY"
	AuthType_REVOKE_ROLE           = "REVOKE_ROLE"
	AuthType_SELECT                = "SELECT"
	AuthType_SHOW                  = "SHOW"
	AuthType_SHOW_CREATE_PROCEDURE = "SHOW_CREATE_PROCEDURE"
	AuthType_SUPER                 = "SUPER"
	AuthType_TRIGGER               = "TRIGGER"
	AuthType_UPDATE                = "UPDATE"
	AuthType_VISIBLE               = "VISIBLE"
)

// These AuthTargetType_ enums are used as the TargetType in AuthInformation. However, these are only built-in
// suggestions that will be used from the accompanying parser. Integrators may produce nodes through other means,
// therefore these are only relevant for the parser's MySQL dialect.
const (
	AuthTargetType_Ignore                   = "IGNORE"
	AuthTargetType_DatabaseIdentifiers      = "DB_IDENTS"
	AuthTargetType_Global                   = "GLOBAL"
	AuthTargetType_MultipleTableIdentifiers = "DB_TABLE_IDENTS"
	AuthTargetType_SingleTableIdentifier    = "DB_TABLE_IDENT"
	AuthTargetType_TableColumn              = "DB_TABLE_COLUMN_IDENT"
	AuthTargetType_TODO                     = "TODO"
)

// SetAuthType sets the AuthType on the given node (if it's an AuthNode), as well as recursively setting the AuthType on
// all children if the node is walkable. Does not overwrite an existing AuthType, and stops walking the children if an
// existing AuthType is encountered. Does not walk the children if walkChildren is false.
func SetAuthType(node SQLNode, authType string, walkChildren bool) SQLNode {
	if authNode, ok := node.(AuthNode); ok {
		authInfo := authNode.GetAuthInformation()
		if len(authInfo.AuthType) == 0 {
			authNode.SetAuthType(authType)
		}
	}
	if walkableNode, ok := node.(WalkableSQLNode); ok && walkChildren {
		_ = walkableNode.walkSubtree(func(node SQLNode) (bool, error) {
			if authNode, ok := node.(AuthNode); ok {
				authInfo := authNode.GetAuthInformation()
				if len(authInfo.AuthType) == 0 {
					authNode.SetAuthType(authType)
					return true, nil
				}
				return false, nil
			}
			return true, nil
		})
	}
	return node
}

// SetAuthTargetType sets the TargetType on the given node (if it's an AuthNode), as well as recursively setting the
// TargetType on all children if the node is walkable. Does not overwrite an existing TargetType, and stops walking the
// children if an existing TargetType is encountered. Does not walk the children if walkChildren is false.
func SetAuthTargetType(node SQLNode, targetType string, walkChildren bool) SQLNode {
	if authNode, ok := node.(AuthNode); ok {
		authInfo := authNode.GetAuthInformation()
		if len(authInfo.TargetType) == 0 {
			authNode.SetAuthTargetType(targetType)
		}
	}
	if walkableNode, ok := node.(WalkableSQLNode); ok && walkChildren {
		_ = walkableNode.walkSubtree(func(node SQLNode) (bool, error) {
			if authNode, ok := node.(AuthNode); ok {
				authInfo := authNode.GetAuthInformation()
				if len(authInfo.TargetType) == 0 {
					authNode.SetAuthTargetType(targetType)
					return true, nil
				}
				return false, nil
			}
			return true, nil
		})
	}
	return node
}

// SetAuthTargetNames sets the TargetNames on the given node (if it's an AuthNode), as well as recursively setting the
// TargetNames on all children if the node is walkable. Does not overwrite an existing TargetNames (one that is not nil,
// meaning a non-nil but empty slice will not be overridden), and stops walking the children if an existing TargetNames
// is encountered. Does not walk the children if walkChildren is false.
func SetAuthTargetNames(node SQLNode, targetNames []string, walkChildren bool) SQLNode {
	if authNode, ok := node.(AuthNode); ok {
		authInfo := authNode.GetAuthInformation()
		if authInfo.TargetNames == nil {
			authNode.SetAuthTargetNames(targetNames)
		}
	}
	if walkableNode, ok := node.(WalkableSQLNode); ok && walkChildren {
		_ = walkableNode.walkSubtree(func(node SQLNode) (bool, error) {
			if authNode, ok := node.(AuthNode); ok {
				authInfo := authNode.GetAuthInformation()
				if authInfo.TargetNames == nil {
					authNode.SetAuthTargetNames(targetNames)
					return true, nil
				}
				return false, nil
			}
			return true, nil
		})
	}
	return node
}

// AppendAuthTargetNames appends the given TargetNames to the ones existing on the given node. If the given node is not
// an AuthNode, then this panics (which indicates that the node was updated without also updating the AuthInformation).
func AppendAuthTargetNames(node SQLNode, targetNames []string) SQLNode {
	authNode, ok := node.(AuthNode)
	if !ok {
		panic(fmt.Errorf("node `%T` is not an AuthNode", node))
	}
	authInfo := authNode.GetAuthInformation()
	existingTargetNames := authInfo.TargetNames
	newTargetNames := make([]string, len(targetNames)+len(existingTargetNames))
	copy(newTargetNames, existingTargetNames)
	copy(newTargetNames[len(existingTargetNames):], targetNames)
	authNode.SetAuthTargetNames(newTargetNames)
	return node
}

// PrependAuthTargetNames prepends the given TargetNames to the ones existing on the given node. If the given node is
// not an AuthNode, then this panics (which indicates that the node was updated without also updating the
// AuthInformation).
func PrependAuthTargetNames(node SQLNode, targetNames []string) SQLNode {
	authNode, ok := node.(AuthNode)
	if !ok {
		panic(fmt.Errorf("node `%T` is not an AuthNode", node))
	}
	authInfo := authNode.GetAuthInformation()
	existingTargetNames := authInfo.TargetNames
	newTargetNames := make([]string, len(targetNames)+len(existingTargetNames))
	copy(newTargetNames, targetNames)
	copy(newTargetNames[len(targetNames):], existingTargetNames)
	authNode.SetAuthTargetNames(newTargetNames)
	return node
}

// OverwriteAuthType sets the AuthType on the given node (if it's an AuthNode), as well as recursively setting the
// AuthType on all children if the node is walkable. Always overwrites an existing AuthType, and will also overwrite all
// children. Does not walk the children if walkChildren is false.
func OverwriteAuthType(node SQLNode, authType string, walkChildren bool) SQLNode {
	if authNode, ok := node.(AuthNode); ok {
		authNode.SetAuthType(authType)
	}
	if walkableNode, ok := node.(WalkableSQLNode); ok && walkChildren {
		_ = walkableNode.walkSubtree(func(node SQLNode) (bool, error) {
			if authNode, ok := node.(AuthNode); ok {
				authNode.SetAuthType(authType)
			}
			return true, nil
		})
	}
	return node
}

// OverwriteAuthTargetType sets the TargetType on the given node (if it's an AuthNode), as well as recursively setting
// the TargetType on all children if the node is walkable. Always overwrites an existing TargetType, and will also
// overwrite all children. Does not walk the children if walkChildren is false.
func OverwriteAuthTargetType(node SQLNode, targetType string, walkChildren bool) SQLNode {
	if authNode, ok := node.(AuthNode); ok {
		authNode.SetAuthTargetType(targetType)
	}
	if walkableNode, ok := node.(WalkableSQLNode); ok && walkChildren {
		_ = walkableNode.walkSubtree(func(node SQLNode) (bool, error) {
			if authNode, ok := node.(AuthNode); ok {
				authNode.SetAuthTargetType(targetType)
			}
			return true, nil
		})
	}
	return node
}

// OverwriteAuthTargetNames sets the TargetNames on the given node (if it's an AuthNode), as well as recursively setting
// the TargetNames on all children if the node is walkable. Always overwrites an existing TargetNames, and will also
// overwrite all children. Does not walk the children if walkChildren is false.
func OverwriteAuthTargetNames(node SQLNode, targetNames []string, walkChildren bool) SQLNode {
	if authNode, ok := node.(AuthNode); ok {
		authNode.SetAuthTargetNames(targetNames)
	}
	if walkableNode, ok := node.(WalkableSQLNode); ok && walkChildren {
		_ = walkableNode.walkSubtree(func(node SQLNode) (bool, error) {
			if authNode, ok := node.(AuthNode); ok {
				authNode.SetAuthTargetNames(targetNames)
			}
			return true, nil
		})
	}
	return node
}

// WalkAuthNodes walks the node tree to find all nodes that implement AuthNode. This allows for fine-grained control of
// modifying AuthInformation within a tree.
func WalkAuthNodes(node SQLNode, f func(node AuthNode, authInfo AuthInformation)) {
	if authNode, ok := node.(AuthNode); ok {
		authInfo := authNode.GetAuthInformation()
		f(authNode, authInfo)
	}
	if walkableNode, ok := node.(WalkableSQLNode); ok {
		_ = walkableNode.walkSubtree(func(node SQLNode) (bool, error) {
			if authNode, ok := node.(AuthNode); ok {
				authInfo := authNode.GetAuthInformation()
				f(authNode, authInfo)
			}
			return true, nil
		})
	}
}

// handleCTEAuth handles auth with CTEs, since we want to ignore any mentions of CTEs as far as auth is concerned. The
// CTE declarations will contain their own auth checks.
func handleCTEAuth(node SQLNode, with *With) {
	if with == nil || node == nil {
		return
	}
	aliases := make(map[string]struct{})
	for _, cte := range with.Ctes {
		aliases[cte.As.String()] = struct{}{}
	}
	WalkAuthNodes(node, func(node AuthNode, authInfo AuthInformation) {
		for _, targetName := range authInfo.TargetNames {
			if _, ok := aliases[targetName]; ok {
				node.SetAuthType(AuthType_IGNORE)
				break
			}
		}
	})
}
