package checkutil

import (
	"context"

	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/condition/eval"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

// BuildTupleKeyConditionFilter returns the TupleKeyConditionFilterFunc for which, together with the tuple key,
// evaluates whether condition is met.
func BuildTupleKeyConditionFilter(ctx context.Context, reqCtx *structpb.Struct, typesys *typesystem.TypeSystem) storage.TupleKeyConditionFilterFunc {
	return func(t *openfgav1.TupleKey) (bool, error) {
		// no condition on tuple or not found gets handled by eval.EvaluateTupleCondition
		cond, _ := typesys.GetCondition(t.GetCondition().GetName())

		return eval.EvaluateTupleCondition(ctx, t, cond, reqCtx)
	}
}

// userFilter returns the ObjectRelation where the object is the specified user.
// If the specified type is publicly assigned type, the object will also include
// publicly wildcard.
func userFilter(hasPubliclyAssignedType bool,
	user,
	userType string) []*openfgav1.ObjectRelation {
	if !hasPubliclyAssignedType || user == tuple.TypedPublicWildcard(userType) {
		return []*openfgav1.ObjectRelation{{
			Object: user,
		}}
	}

	return []*openfgav1.ObjectRelation{
		{Object: user},
		{Object: tuple.TypedPublicWildcard(userType)},
	}
}

// TODO: These (graph.ResolveCheckRequest, graph.ResolveCheckResponse) should be moved to a shared package to avoid having
// to duplicate across, and have better composition.
type resolveCheckRequest interface {
	GetStoreID() string
	GetTupleKey() *openfgav1.TupleKey
	GetConsistency() openfgav1.ConsistencyPreference
	GetContext() *structpb.Struct
}

func IteratorReadUsersetTuples(ctx context.Context,
	req resolveCheckRequest,
	allowedUserTypeRestrictions []*openfgav1.RelationReference) (storage.TupleKeyIterator, error) {
	opts := storage.ReadUsersetTuplesOptions{
		Consistency: storage.ConsistencyOptions{
			Preference: req.GetConsistency(),
		},
	}

	typesys, _ := typesystem.TypesystemFromContext(ctx)
	ds, _ := storage.RelationshipTupleReaderFromContext(ctx)

	iter, err := ds.ReadUsersetTuples(ctx, req.GetStoreID(), storage.ReadUsersetTuplesFilter{
		Object:                      req.GetTupleKey().GetObject(),
		Relation:                    req.GetTupleKey().GetRelation(),
		AllowedUserTypeRestrictions: allowedUserTypeRestrictions,
	}, opts)
	if err != nil {
		return nil, err
	}

	return storage.NewConditionsFilteredTupleKeyIterator(
		storage.NewFilteredTupleKeyIterator(
			storage.NewTupleKeyIteratorFromTupleIterator(iter),
			validation.FilterInvalidTuples(typesys),
		),
		BuildTupleKeyConditionFilter(ctx, req.GetContext(), typesys),
	), nil
}

// IteratorReadStartingFromUser returns storage iterator for
// user with request's type and relation with specified objectIDs as
// filter.
func IteratorReadStartingFromUser(ctx context.Context,
	typesys *typesystem.TypeSystem,
	ds storage.RelationshipTupleReader,
	req resolveCheckRequest,
	objectRel string,
	objectIDs storage.SortedSet,
	sortContextualTuples bool) (storage.TupleKeyIterator, error) {
	storeID := req.GetStoreID()
	reqTupleKey := req.GetTupleKey()

	opts := storage.ReadStartingWithUserOptions{
		WithResultsSortedAscending: sortContextualTuples,
		Consistency: storage.ConsistencyOptions{
			Preference: req.GetConsistency(),
		},
	}

	user := reqTupleKey.GetUser()
	userType := tuple.GetType(user)
	objectType, relation := tuple.SplitObjectRelation(objectRel)
	// TODO: add in optimization to filter out user not matching the type

	relationReference := typesystem.DirectRelationReference(objectType, relation)
	hasPubliclyAssignedType, _ := typesys.IsPubliclyAssignable(relationReference, userType)

	iter, err := ds.ReadStartingWithUser(ctx, storeID,
		storage.ReadStartingWithUserFilter{
			ObjectType: objectType,
			Relation:   relation,
			UserFilter: userFilter(hasPubliclyAssignedType, user, userType),
			ObjectIDs:  objectIDs,
		}, opts)
	if err != nil {
		return nil, err
	}

	return storage.NewConditionsFilteredTupleKeyIterator(
		storage.NewFilteredTupleKeyIterator(
			storage.NewTupleKeyIteratorFromTupleIterator(iter),
			validation.FilterInvalidTuples(typesys),
		),
		BuildTupleKeyConditionFilter(ctx, req.GetContext(), typesys),
	), nil
}

type V2RelationFunc func(*openfgav1.RelationReference) string

// BuildUsersetV2RelationFunc returns the reference's relation.
func BuildUsersetV2RelationFunc() V2RelationFunc {
	return func(ref *openfgav1.RelationReference) string {
		return ref.GetRelation()
	}
}

// BuildTTUV2RelationFunc will always return the computedRelation regardless of the reference.
func BuildTTUV2RelationFunc(computedRelation string) V2RelationFunc {
	return func(_ *openfgav1.RelationReference) string {
		return computedRelation
	}
}
