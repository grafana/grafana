package authz

import (
	"context"
	"fmt"
	"strings"
	"sync"

	grpc_ctxtags "github.com/grpc-ecosystem/go-grpc-middleware/tags"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	parser "github.com/openfga/language/pkg/go/utils"

	"github.com/openfga/openfga/internal/utils/apimethod"
	"github.com/openfga/openfga/pkg/authclaims"
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

const (
	accessControlKey = "access_control"

	// MaxModulesInRequest Max number of modules a user is allowed to write in a single request if they do not have write permissions to the store.
	MaxModulesInRequest = 1

	// Relations.
	CanCallReadAuthorizationModels  = "can_call_read_authorization_models"
	CanCallRead                     = "can_call_read"
	CanCallWrite                    = "can_call_write"
	CanCallListObjects              = "can_call_list_objects"
	CanCallCheck                    = "can_call_check"
	CanCallListUsers                = "can_call_list_users"
	CanCallWriteAssertions          = "can_call_write_assertions"
	CanCallReadAssertions           = "can_call_read_assertions"
	CanCallWriteAuthorizationModels = "can_call_write_authorization_models"
	CanCallListStores               = "can_call_list_stores"
	CanCallCreateStore              = "can_call_create_stores"
	CanCallGetStore                 = "can_call_get_store"
	CanCallDeleteStore              = "can_call_delete_store"
	CanCallExpand                   = "can_call_expand"
	CanCallReadChanges              = "can_call_read_changes"

	StoreType             = "store"
	ModuleType            = "module"
	ApplicationType       = "application"
	SystemType            = "system"
	SystemRelationOnStore = "system"
	RootSystemID          = "fga"
)

var (
	ErrUnauthorizedResponse = status.Error(codes.Code(openfgav1.AuthErrorCode_forbidden), "the principal is not authorized to perform the action")
	SystemObjectID          = fmt.Sprintf("%s:%s", SystemType, RootSystemID)
	tracer                  = otel.Tracer("internal/authz")
)

type StoreIDType string

func (s StoreIDType) String() string {
	return fmt.Sprintf("%s:%s", StoreType, string(s))
}

type ClientIDType string

func (c ClientIDType) String() string {
	return fmt.Sprintf("%s:%s", ApplicationType, string(c))
}

type ModuleIDType string

func (m ModuleIDType) String(module string) string {
	return fmt.Sprintf(`%s:%s|%s`, ModuleType, string(m), module)
}

type Config struct {
	StoreID string
	ModelID string
}

type AuthorizerInterface interface {
	Authorize(ctx context.Context, storeID string, apiMethod apimethod.APIMethod, modules ...string) error
	AuthorizeCreateStore(ctx context.Context) error
	AuthorizeListStores(ctx context.Context) error
	ListAuthorizedStores(ctx context.Context) ([]string, error)
	GetModulesForWriteRequest(ctx context.Context, req *openfgav1.WriteRequest, typesys *typesystem.TypeSystem) ([]string, error)
	AccessControlStoreID() string
}

type NoopAuthorizer struct{}

func NewAuthorizerNoop() *NoopAuthorizer {
	return &NoopAuthorizer{}
}

func (a *NoopAuthorizer) Authorize(ctx context.Context, storeID string, apiMethod apimethod.APIMethod, modules ...string) error {
	return nil
}

func (a *NoopAuthorizer) AuthorizeCreateStore(ctx context.Context) error {
	return nil
}

func (a *NoopAuthorizer) AuthorizeListStores(ctx context.Context) error {
	return nil
}

func (a *NoopAuthorizer) ListAuthorizedStores(ctx context.Context) ([]string, error) {
	return nil, nil
}

func (a *NoopAuthorizer) GetModulesForWriteRequest(ctx context.Context, req *openfgav1.WriteRequest, typesys *typesystem.TypeSystem) ([]string, error) {
	return nil, nil
}

func (a *NoopAuthorizer) AccessControlStoreID() string {
	return ""
}

type Authorizer struct {
	config *Config
	server ServerInterface
	logger logger.Logger
}

func NewAuthorizer(config *Config, server ServerInterface, logger logger.Logger) *Authorizer {
	return &Authorizer{
		config: config,
		server: server,
		logger: logger,
	}
}

type authorizationError struct {
	Cause string
}

func (e *authorizationError) Error() string {
	return e.Cause
}

func (a *Authorizer) getRelation(apiMethod apimethod.APIMethod) (string, error) {
	// TODO: Add a golangci-linter rule to ensure all the possible cases are handled.
	switch apiMethod {
	case apimethod.ReadAuthorizationModel, apimethod.ReadAuthorizationModels:
		return CanCallReadAuthorizationModels, nil
	case apimethod.Read:
		return CanCallRead, nil
	case apimethod.Write:
		return CanCallWrite, nil
	case apimethod.ListObjects, apimethod.StreamedListObjects:
		return CanCallListObjects, nil
	case apimethod.Check, apimethod.BatchCheck:
		return CanCallCheck, nil
	case apimethod.ListUsers:
		return CanCallListUsers, nil
	case apimethod.WriteAssertions:
		return CanCallWriteAssertions, nil
	case apimethod.ReadAssertions:
		return CanCallReadAssertions, nil
	case apimethod.WriteAuthorizationModel:
		return CanCallWriteAuthorizationModels, nil
	case apimethod.ListStores:
		return CanCallListStores, nil
	case apimethod.CreateStore:
		return CanCallCreateStore, nil
	case apimethod.GetStore:
		return CanCallGetStore, nil
	case apimethod.DeleteStore:
		return CanCallDeleteStore, nil
	case apimethod.Expand:
		return CanCallExpand, nil
	case apimethod.ReadChanges:
		return CanCallReadChanges, nil
	default:
		return "", fmt.Errorf("unknown API method: %s", apiMethod)
	}
}

func (a *Authorizer) AccessControlStoreID() string {
	if a.config != nil {
		return a.config.StoreID
	}
	return ""
}

// Authorize checks if the user has access to the resource.
func (a *Authorizer) Authorize(ctx context.Context, storeID string, apiMethod apimethod.APIMethod, modules ...string) error {
	methodName := "Authorize"
	ctx, span := tracer.Start(ctx, methodName, trace.WithAttributes(
		attribute.String("storeID", storeID),
		attribute.String("apiMethod", apiMethod.String()),
		attribute.String("modules", strings.Join(modules, ",")),
	))
	defer span.End()

	grpc_ctxtags.Extract(ctx).Set(accessControlKey, methodName)

	claims, err := checkAuthClaims(ctx)
	if err != nil {
		return err
	}

	relation, err := a.getRelation(apiMethod)
	if err != nil {
		return &authorizationError{Cause: fmt.Sprintf("error getting relation: %v", err)}
	}

	contextualTuples := openfgav1.ContextualTupleKeys{
		TupleKeys: []*openfgav1.TupleKey{
			getSystemAccessTuple(storeID),
		},
	}

	// Check if there is top-level authorization first, before checking modules
	err = a.individualAuthorize(ctx, claims.ClientID, relation, StoreIDType(storeID).String(), &contextualTuples)
	if err == nil {
		return nil
	}

	if len(modules) > 0 {
		// If there is no top level authorization, but the max modules limit is exceeded, return an error regarding that limit
		// Having a limit helps ensure we do not run too many checks on every write when there are modules
		if len(modules) > MaxModulesInRequest {
			return &authorizationError{Cause: fmt.Sprintf("the principal cannot write tuples of more than %v module(s) in a single request (modules in request: %v)", MaxModulesInRequest, len(modules))}
		}

		return a.moduleAuthorize(ctx, claims.ClientID, relation, storeID, modules)
	}

	// If there are no modules to check, return the top-level authorization error
	return err
}

// AuthorizeCreateStore checks if the user has access to create a store.
func (a *Authorizer) AuthorizeCreateStore(ctx context.Context) error {
	methodName := "AuthorizeCreateStore"
	ctx, span := tracer.Start(ctx, methodName)
	defer span.End()

	grpc_ctxtags.Extract(ctx).Set(accessControlKey, methodName)

	claims, err := checkAuthClaims(ctx)
	if err != nil {
		return err
	}

	relation, err := a.getRelation(apimethod.CreateStore)
	if err != nil {
		return err
	}

	return a.individualAuthorize(ctx, claims.ClientID, relation, SystemObjectID, &openfgav1.ContextualTupleKeys{})
}

// AuthorizeListStores checks if the user has access to list stores.
func (a *Authorizer) AuthorizeListStores(ctx context.Context) error {
	methodName := "AuthorizeListStores"
	ctx, span := tracer.Start(ctx, methodName)
	defer span.End()

	grpc_ctxtags.Extract(ctx).Set(accessControlKey, methodName)

	claims, err := checkAuthClaims(ctx)
	if err != nil {
		return err
	}

	relation, err := a.getRelation(apimethod.ListStores)
	if err != nil {
		return err
	}

	return a.individualAuthorize(ctx, claims.ClientID, relation, SystemObjectID, &openfgav1.ContextualTupleKeys{})
}

// ListAuthorizedStores returns the list of store IDs that the user has access to.
func (a *Authorizer) ListAuthorizedStores(ctx context.Context) ([]string, error) {
	methodName := "ListAuthorizedStores"
	ctx, span := tracer.Start(ctx, methodName)
	defer span.End()

	grpc_ctxtags.Extract(ctx).Set(accessControlKey, methodName)

	claims, err := checkAuthClaims(ctx)
	if err != nil {
		return nil, err
	}

	req := &openfgav1.ListObjectsRequest{
		StoreId:              a.config.StoreID,
		AuthorizationModelId: a.config.ModelID,
		User:                 ClientIDType(claims.ClientID).String(),
		Relation:             CanCallGetStore,
		Type:                 StoreType,
	}

	// Disable authz check for the list objects request.
	ctx = authclaims.ContextWithSkipAuthzCheck(ctx, true)
	resp, err := a.server.ListObjects(ctx, req)
	if err != nil {
		return nil, &authorizationError{Cause: fmt.Sprintf("list objects returned error: %v", err)}
	}

	storeIDs := make([]string, len(resp.GetObjects()))
	storePrefix := StoreType + ":"
	for i, store := range resp.GetObjects() {
		storeIDs[i] = strings.TrimPrefix(store, storePrefix)
	}

	return storeIDs, nil
}

// GetModulesForWriteRequest returns the modules that should be checked for the write request.
// If we encounter a type with no attached module, we should break and return no modules so that the authz check will be against the store
// Otherwise we return a list of unique modules encountered so that FGA on FGA can check them after.
func (a *Authorizer) GetModulesForWriteRequest(ctx context.Context, req *openfgav1.WriteRequest, typesys *typesystem.TypeSystem) ([]string, error) {
	methodName := "GetModulesForWriteRequest"
	ctx, span := tracer.Start(ctx, methodName)
	defer span.End()

	grpc_ctxtags.Extract(ctx).Set(accessControlKey, methodName)

	tuples := make([]TupleKeyInterface, len(req.GetWrites().GetTupleKeys())+len(req.GetDeletes().GetTupleKeys()))
	var index int
	for _, tuple := range req.GetWrites().GetTupleKeys() {
		tuples[index] = tuple
		index++
	}
	for _, tuple := range req.GetDeletes().GetTupleKeys() {
		tuples[index] = tuple
		index++
	}

	modulesMap, err := extractModulesFromTuples(tuples, typesys)
	if err != nil {
		return nil, err
	}

	modules := make([]string, len(modulesMap))
	var i int
	for module := range modulesMap {
		modules[i] = module
		i++
	}

	return modules, nil
}

// TupleKeyInterface is an interface that both TupleKeyWithoutCondition and TupleKey implement.
type TupleKeyInterface interface {
	GetObject() string
	GetRelation() string
}

// extractModulesFromTuples extracts the modules from the tuples. If a type has no module, we
// return an empty map so that the caller can handle authorization for tuples without modules.
func extractModulesFromTuples[T TupleKeyInterface](tupleKeys []T, typesys *typesystem.TypeSystem) (map[string]struct{}, error) {
	modulesMap := make(map[string]struct{})
	for _, tupleKey := range tupleKeys {
		objType, _ := tuple.SplitObject(tupleKey.GetObject())
		objectType, ok := typesys.GetTypeDefinition(objType)
		if !ok {
			return nil, &authorizationError{Cause: fmt.Sprintf("type '%s' not found", objType)}
		}
		module, err := parser.GetModuleForObjectTypeRelation(objectType, tupleKey.GetRelation())
		if err != nil {
			return nil, err
		}
		if module == "" {
			return nil, nil
		}
		modulesMap[module] = struct{}{}
	}

	return modulesMap, nil
}

func (a *Authorizer) individualAuthorize(ctx context.Context, clientID, relation, object string, contextualTuples *openfgav1.ContextualTupleKeys) error {
	ctx, span := tracer.Start(ctx, "individualAuthorize", trace.WithAttributes(
		attribute.String("clientID", clientID),
		attribute.String("relation", relation),
		attribute.String("object", object),
	))
	defer span.End()

	req := &openfgav1.CheckRequest{
		StoreId:              a.config.StoreID,
		AuthorizationModelId: a.config.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     ClientIDType(clientID).String(),
			Relation: relation,
			Object:   object,
		},
		ContextualTuples: contextualTuples,
	}

	// Disable authz check for the check request.
	ctx = authclaims.ContextWithSkipAuthzCheck(ctx, true)
	resp, err := a.server.Check(ctx, req)
	if err != nil {
		return &authorizationError{Cause: fmt.Sprintf("check returned error: %v", err)}
	}

	if !resp.GetAllowed() {
		return &authorizationError{Cause: "check returned not allowed"}
	}

	return nil
}

// moduleAuthorize checks if the user has access to each of the modules, and exits if an error is encountered.
func (a *Authorizer) moduleAuthorize(ctx context.Context, clientID, relation, storeID string, modules []string) error {
	ctx, span := tracer.Start(ctx, "moduleAuthorize", trace.WithAttributes(
		attribute.String("clientID", clientID),
		attribute.String("relation", relation),
		attribute.String("storeID", storeID),
		attribute.String("modules", strings.Join(modules, ",")),
	))
	defer span.End()

	var wg sync.WaitGroup
	errorChannel := make(chan error, len(modules))

	for _, module := range modules {
		wg.Add(1)
		go func(module string) {
			defer wg.Done()
			contextualTuples := openfgav1.ContextualTupleKeys{
				TupleKeys: []*openfgav1.TupleKey{
					{
						User:     StoreIDType(storeID).String(),
						Relation: StoreType,
						Object:   ModuleIDType(storeID).String(module),
					},
					getSystemAccessTuple(storeID),
				},
			}

			err := a.individualAuthorize(ctx, clientID, relation, ModuleIDType(storeID).String(module), &contextualTuples)

			if err != nil {
				errorChannel <- err
			}
		}(module)
	}

	wg.Wait()
	close(errorChannel)

	for err := range errorChannel {
		if err != nil {
			return err
		}
	}

	return nil
}

// checkAuthClaims checks the auth claims in the context.
func checkAuthClaims(ctx context.Context) (*authclaims.AuthClaims, error) {
	claims, found := authclaims.AuthClaimsFromContext(ctx)
	if !found || claims.ClientID == "" {
		return nil, &authorizationError{Cause: "client ID not found in context or is empty"}
	}
	return claims, nil
}

func getSystemAccessTuple(storeID string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     SystemObjectID,
		Relation: SystemRelationOnStore,
		Object:   StoreIDType(storeID).String(),
	}
}
