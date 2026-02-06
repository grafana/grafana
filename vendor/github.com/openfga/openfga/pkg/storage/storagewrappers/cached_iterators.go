package storagewrappers

import (
	"context"

	"google.golang.org/protobuf/types/known/timestamppb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
)

// cachedTupleIterator is a wrapper around an iterator
// for a given object/relation.
type cachedTupleIterator struct {
	objectID   string
	objectType string
	relation   string
	userType   string
	iter       storage.Iterator[*storage.TupleRecord]
	stopped    bool
}

var _ storage.TupleIterator = (*cachedTupleIterator)(nil)

// Next will return the next available minimal cached tuple
// as a well-formed [openfgav1.Tuple].
func (c *cachedTupleIterator) Next(ctx context.Context) (*openfgav1.Tuple, error) {
	t, err := c.iter.Next(ctx)
	if err != nil {
		return nil, err
	}

	return c.buildTuple(t), nil
}

// Stop see [storage.Iterator].Stop.
func (c *cachedTupleIterator) Stop() {
	newStop := !c.stopped
	c.stopped = true
	c.iter.Stop()
	if newStop {
		currentIteratorCacheCount.WithLabelValues("true").Dec()
	}
}

// Head will return the first minimal cached tuple of the iterator as
// a well-formed [openfgav1.Tuple].
func (c *cachedTupleIterator) Head(ctx context.Context) (*openfgav1.Tuple, error) {
	t, err := c.iter.Head(ctx)
	if err != nil {
		return nil, err
	}

	return c.buildTuple(t), nil
}

func (c *cachedTupleIterator) buildTuple(t *storage.TupleRecord) *openfgav1.Tuple {
	objectType := t.ObjectType
	objectID := t.ObjectID
	relation := t.Relation
	userType := t.UserObjectType

	if c.objectType != "" {
		objectType = c.objectType
	}

	if c.objectID != "" {
		objectID = c.objectID
	}

	if c.relation != "" {
		relation = c.relation
	}

	if c.userType != "" {
		userType = c.userType
	}

	return &openfgav1.Tuple{
		Key: tuple.NewTupleKeyWithCondition(
			tuple.BuildObject(objectType, objectID),
			relation,
			tuple.FromUserParts(userType, t.UserObjectID, t.UserRelation),
			t.ConditionName,
			t.ConditionContext,
		),
		Timestamp: timestamppb.New(t.InsertedAt),
	}
}
