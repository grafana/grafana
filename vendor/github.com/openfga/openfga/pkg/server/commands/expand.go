package commands

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"golang.org/x/sync/errgroup"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	openfgaErrors "github.com/openfga/openfga/internal/errors"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/logger"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/storagewrappers"
	tupleUtils "github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

// ExpandQuery resolves a target TupleKey into a UsersetTree by expanding type definitions.
type ExpandQuery struct {
	logger    logger.Logger
	datastore storage.RelationshipTupleReader
}

type ExpandQueryOption func(*ExpandQuery)

func WithExpandQueryLogger(l logger.Logger) ExpandQueryOption {
	return func(eq *ExpandQuery) {
		eq.logger = l
	}
}

// NewExpandQuery creates a new ExpandQuery using the supplied backends for retrieving data.
func NewExpandQuery(datastore storage.OpenFGADatastore, opts ...ExpandQueryOption) *ExpandQuery {
	eq := &ExpandQuery{
		datastore: datastore,
		logger:    logger.NewNoopLogger(),
	}

	for _, opt := range opts {
		opt(eq)
	}
	return eq
}

func (q *ExpandQuery) Execute(ctx context.Context, req *openfgav1.ExpandRequest) (*openfgav1.ExpandResponse, error) {
	store := req.GetStoreId()
	tupleKey := req.GetTupleKey()
	object := tupleKey.GetObject()
	relation := tupleKey.GetRelation()

	if object == "" || relation == "" {
		return nil, serverErrors.ErrInvalidExpandInput
	}

	tk := tupleUtils.NewTupleKey(object, relation, "")

	typesys, ok := typesystem.TypesystemFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("%w: typesystem missing in context", openfgaErrors.ErrUnknown)
	}

	for _, ctxTuple := range req.GetContextualTuples().GetTupleKeys() {
		if err := validation.ValidateTupleForWrite(typesys, ctxTuple); err != nil {
			return nil, serverErrors.HandleTupleValidateError(err)
		}
	}

	err := validation.ValidateObject(typesys, tk)
	if err != nil {
		return nil, serverErrors.ValidationError(err)
	}

	err = validation.ValidateRelation(typesys, tk)
	if err != nil {
		return nil, serverErrors.ValidationError(err)
	}

	q.datastore = storagewrappers.NewCombinedTupleReader(
		q.datastore,
		req.GetContextualTuples().GetTupleKeys(),
	)

	objectType := tupleUtils.GetType(object)
	rel, err := typesys.GetRelation(objectType, relation)
	if err != nil {
		if errors.Is(err, typesystem.ErrObjectTypeUndefined) {
			return nil, serverErrors.TypeNotFound(objectType)
		}

		if errors.Is(err, typesystem.ErrRelationUndefined) {
			return nil, serverErrors.RelationNotFound(relation, objectType, tk)
		}

		return nil, serverErrors.HandleError("", err)
	}

	userset := rel.GetRewrite()

	root, err := q.resolveUserset(ctx, store, userset, tk, typesys, req.GetConsistency())
	if err != nil {
		return nil, err
	}

	return &openfgav1.ExpandResponse{
		Tree: &openfgav1.UsersetTree{
			Root: root,
		},
	}, nil
}

func (q *ExpandQuery) resolveUserset(
	ctx context.Context,
	store string,
	userset *openfgav1.Userset,
	tk *openfgav1.TupleKey,
	typesys *typesystem.TypeSystem,
	consistency openfgav1.ConsistencyPreference,
) (*openfgav1.UsersetTree_Node, error) {
	ctx, span := tracer.Start(ctx, "resolveUserset")
	defer span.End()

	switch us := userset.GetUserset().(type) {
	case nil, *openfgav1.Userset_This:
		return q.resolveThis(ctx, store, tk, typesys, consistency)
	case *openfgav1.Userset_ComputedUserset:
		return q.resolveComputedUserset(ctx, us.ComputedUserset, tk)
	case *openfgav1.Userset_TupleToUserset:
		return q.resolveTupleToUserset(ctx, store, us.TupleToUserset, tk, typesys, consistency)
	case *openfgav1.Userset_Union:
		return q.resolveUnionUserset(ctx, store, us.Union, tk, typesys, consistency)
	case *openfgav1.Userset_Difference:
		return q.resolveDifferenceUserset(ctx, store, us.Difference, tk, typesys, consistency)
	case *openfgav1.Userset_Intersection:
		return q.resolveIntersectionUserset(ctx, store, us.Intersection, tk, typesys, consistency)
	default:
		return nil, serverErrors.ErrUnsupportedUserSet
	}
}

// resolveThis resolves a DirectUserset into a leaf node containing a distinct set of users with that relation.
func (q *ExpandQuery) resolveThis(ctx context.Context, store string, tk *openfgav1.TupleKey, typesys *typesystem.TypeSystem, consistency openfgav1.ConsistencyPreference) (*openfgav1.UsersetTree_Node, error) {
	ctx, span := tracer.Start(ctx, "resolveThis")
	defer span.End()

	opts := storage.ReadOptions{
		Consistency: storage.ConsistencyOptions{
			Preference: consistency,
		},
	}

	filter := storage.ReadFilter{
		Object:   tk.GetObject(),
		Relation: tk.GetRelation(),
		User:     tk.GetUser(),
	}

	tupleIter, err := q.datastore.Read(ctx, store, filter, opts)
	if err != nil {
		return nil, serverErrors.HandleError("", err)
	}

	filteredIter := storage.NewFilteredTupleKeyIterator(
		storage.NewTupleKeyIteratorFromTupleIterator(tupleIter),
		validation.FilterInvalidTuples(typesys),
	)
	defer filteredIter.Stop()

	distinctUsers := make(map[string]bool)
	for {
		tk, err := filteredIter.Next(ctx)
		if err != nil {
			if errors.Is(err, storage.ErrIteratorDone) {
				break
			}
			return nil, serverErrors.HandleError("", err)
		}
		distinctUsers[tk.GetUser()] = true
	}

	users := make([]string, 0, len(distinctUsers))
	for u := range distinctUsers {
		users = append(users, u)
	}

	// to make output array deterministic
	slices.Sort(users)

	return &openfgav1.UsersetTree_Node{
		Name: toObjectRelation(tk),
		Value: &openfgav1.UsersetTree_Node_Leaf{
			Leaf: &openfgav1.UsersetTree_Leaf{
				Value: &openfgav1.UsersetTree_Leaf_Users{
					Users: &openfgav1.UsersetTree_Users{
						Users: users,
					},
				},
			},
		},
	}, nil
}

// resolveComputedUserset builds a leaf node containing the result of resolving a ComputedUserset rewrite.
func (q *ExpandQuery) resolveComputedUserset(ctx context.Context, userset *openfgav1.ObjectRelation, tk *openfgav1.TupleKey) (*openfgav1.UsersetTree_Node, error) {
	_, span := tracer.Start(ctx, "resolveComputedUserset")
	defer span.End()

	computed := &openfgav1.TupleKey{
		Object:   userset.GetObject(),
		Relation: userset.GetRelation(),
	}

	if len(computed.GetObject()) == 0 {
		computed.Object = tk.GetObject()
	}

	if len(computed.GetRelation()) == 0 {
		computed.Relation = tk.GetRelation()
	}

	return &openfgav1.UsersetTree_Node{
		Name: toObjectRelation(tk),
		Value: &openfgav1.UsersetTree_Node_Leaf{
			Leaf: &openfgav1.UsersetTree_Leaf{
				Value: &openfgav1.UsersetTree_Leaf_Computed{
					Computed: &openfgav1.UsersetTree_Computed{
						Userset: toObjectRelation(computed),
					},
				},
			},
		},
	}, nil
}

// resolveTupleToUserset creates a new leaf node containing the result of expanding a TupleToUserset rewrite.
func (q *ExpandQuery) resolveTupleToUserset(
	ctx context.Context,
	store string,
	userset *openfgav1.TupleToUserset,
	tk *openfgav1.TupleKey,
	typesys *typesystem.TypeSystem,
	consistency openfgav1.ConsistencyPreference,
) (*openfgav1.UsersetTree_Node, error) {
	ctx, span := tracer.Start(ctx, "resolveTupleToUserset")
	defer span.End()

	targetObject := tk.GetObject()

	tupleset := userset.GetTupleset().GetRelation()

	objectType := tupleUtils.GetType(targetObject)
	_, err := typesys.GetRelation(objectType, tupleset)
	if err != nil {
		if errors.Is(err, typesystem.ErrObjectTypeUndefined) {
			return nil, serverErrors.TypeNotFound(objectType)
		}

		if errors.Is(err, typesystem.ErrRelationUndefined) {
			return nil, serverErrors.RelationNotFound(tupleset, objectType, tupleUtils.NewTupleKey(tk.GetObject(), tupleset, tk.GetUser()))
		}
	}

	tsKey := &openfgav1.TupleKey{
		Object:   targetObject,
		Relation: tupleset,
	}

	if tsKey.GetRelation() == "" {
		tsKey.Relation = tk.GetRelation()
	}

	opts := storage.ReadOptions{
		Consistency: storage.ConsistencyOptions{
			Preference: consistency,
		},
	}
	filter := storage.ReadFilter{
		Object:   tsKey.GetObject(),
		Relation: tsKey.GetRelation(),
		User:     tsKey.GetUser(),
	}

	tupleIter, err := q.datastore.Read(ctx, store, filter, opts)
	if err != nil {
		return nil, serverErrors.HandleError("", err)
	}

	filteredIter := storage.NewFilteredTupleKeyIterator(
		storage.NewTupleKeyIteratorFromTupleIterator(tupleIter),
		validation.FilterInvalidTuples(typesys),
	)
	defer filteredIter.Stop()

	var computed []*openfgav1.UsersetTree_Computed
	seen := make(map[string]bool)
	for {
		tk, err := filteredIter.Next(ctx)
		if err != nil {
			if errors.Is(err, storage.ErrIteratorDone) {
				break
			}
			return nil, serverErrors.HandleError("", err)
		}
		user := tk.GetUser()

		tObject, tRelation := tupleUtils.SplitObjectRelation(user)
		// We only proceed in the case that tRelation == userset.GetComputedUserset().GetRelation().
		// tRelation may be empty, and in this case, we set it to userset.GetComputedUserset().GetRelation().
		if tRelation == "" {
			tRelation = userset.GetComputedUserset().GetRelation()
		}

		cs := &openfgav1.TupleKey{
			Object:   tObject,
			Relation: tRelation,
		}

		computedRelation := toObjectRelation(cs)
		if !seen[computedRelation] {
			computed = append(computed, &openfgav1.UsersetTree_Computed{Userset: computedRelation})
			seen[computedRelation] = true
		}
	}

	return &openfgav1.UsersetTree_Node{
		Name: toObjectRelation(tk),
		Value: &openfgav1.UsersetTree_Node_Leaf{
			Leaf: &openfgav1.UsersetTree_Leaf{
				Value: &openfgav1.UsersetTree_Leaf_TupleToUserset{
					TupleToUserset: &openfgav1.UsersetTree_TupleToUserset{
						Tupleset: toObjectRelation(tsKey),
						Computed: computed,
					},
				},
			},
		},
	}, nil
}

// resolveUnionUserset creates an intermediate Usertree node containing the union of its children.
func (q *ExpandQuery) resolveUnionUserset(
	ctx context.Context,
	store string,
	usersets *openfgav1.Usersets,
	tk *openfgav1.TupleKey,
	typesys *typesystem.TypeSystem,
	consistency openfgav1.ConsistencyPreference,
) (*openfgav1.UsersetTree_Node, error) {
	ctx, span := tracer.Start(ctx, "resolveUnionUserset")
	defer span.End()

	nodes, err := q.resolveUsersets(ctx, store, usersets.GetChild(), tk, typesys, consistency)
	if err != nil {
		return nil, err
	}
	return &openfgav1.UsersetTree_Node{
		Name: toObjectRelation(tk),
		Value: &openfgav1.UsersetTree_Node_Union{
			Union: &openfgav1.UsersetTree_Nodes{
				Nodes: nodes,
			},
		},
	}, nil
}

// resolveIntersectionUserset create an intermediate Usertree node containing the intersection of its children.
func (q *ExpandQuery) resolveIntersectionUserset(
	ctx context.Context,
	store string,
	usersets *openfgav1.Usersets,
	tk *openfgav1.TupleKey,
	typesys *typesystem.TypeSystem,
	consistency openfgav1.ConsistencyPreference,
) (*openfgav1.UsersetTree_Node, error) {
	ctx, span := tracer.Start(ctx, "resolveIntersectionUserset")
	defer span.End()

	nodes, err := q.resolveUsersets(ctx, store, usersets.GetChild(), tk, typesys, consistency)
	if err != nil {
		return nil, err
	}
	return &openfgav1.UsersetTree_Node{
		Name: toObjectRelation(tk),
		Value: &openfgav1.UsersetTree_Node_Intersection{
			Intersection: &openfgav1.UsersetTree_Nodes{
				Nodes: nodes,
			},
		},
	}, nil
}

// resolveDifferenceUserset creates and intermediate Usertree node containing the difference of its children.
func (q *ExpandQuery) resolveDifferenceUserset(
	ctx context.Context,
	store string,
	userset *openfgav1.Difference,
	tk *openfgav1.TupleKey,
	typesys *typesystem.TypeSystem,
	consistency openfgav1.ConsistencyPreference,
) (*openfgav1.UsersetTree_Node, error) {
	ctx, span := tracer.Start(ctx, "resolveDifferenceUserset")
	defer span.End()

	nodes, err := q.resolveUsersets(ctx, store, []*openfgav1.Userset{userset.GetBase(), userset.GetSubtract()}, tk, typesys, consistency)
	if err != nil {
		return nil, err
	}
	base := nodes[0]
	subtract := nodes[1]
	return &openfgav1.UsersetTree_Node{
		Name: toObjectRelation(tk),
		Value: &openfgav1.UsersetTree_Node_Difference{
			Difference: &openfgav1.UsersetTree_Difference{
				Base:     base,
				Subtract: subtract,
			},
		},
	}, nil
}

// resolveUsersets creates Usertree nodes for multiple Usersets.
func (q *ExpandQuery) resolveUsersets(
	ctx context.Context,
	store string,
	usersets []*openfgav1.Userset,
	tk *openfgav1.TupleKey,
	typesys *typesystem.TypeSystem,
	consistency openfgav1.ConsistencyPreference,
) ([]*openfgav1.UsersetTree_Node, error) {
	ctx, span := tracer.Start(ctx, "resolveUsersets")
	defer span.End()

	out := make([]*openfgav1.UsersetTree_Node, len(usersets))
	grp, ctx := errgroup.WithContext(ctx)
	for i, us := range usersets {
		// https://golang.org/doc/faq#closures_and_goroutines
		grp.Go(func() error {
			node, err := q.resolveUserset(ctx, store, us, tk, typesys, consistency)
			if err != nil {
				return err
			}
			out[i] = node
			return nil
		})
	}
	if err := grp.Wait(); err != nil {
		return nil, err
	}
	return out, nil
}

func toObjectRelation(tk *openfgav1.TupleKey) string {
	return tupleUtils.ToObjectRelationString(tk.GetObject(), tk.GetRelation())
}
