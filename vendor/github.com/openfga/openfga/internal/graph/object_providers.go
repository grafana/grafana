package graph

import (
	"context"
	"errors"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/checkutil"
	"github.com/openfga/openfga/internal/concurrency"
	"github.com/openfga/openfga/internal/iterator"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

// objectProvider is an interface that abstracts the building of a channel that holds object IDs or usersets.
// It must close the channel when there are no more results.
type objectProvider interface {
	End()
	Begin(ctx context.Context, req *ResolveCheckRequest) (<-chan usersetMessage, error)
}

type recursiveTTUObjectProvider struct {
	ts               *typesystem.TypeSystem
	tuplesetRelation string
	computedRelation string
	cancel           context.CancelFunc
}

func newRecursiveTTUObjectProvider(ts *typesystem.TypeSystem, ttu *openfgav1.TupleToUserset) *recursiveTTUObjectProvider {
	tuplesetRelation := ttu.GetTupleset().GetRelation()
	computedRelation := ttu.GetComputedUserset().GetRelation()
	return &recursiveTTUObjectProvider{ts: ts, tuplesetRelation: tuplesetRelation, computedRelation: computedRelation}
}

var _ objectProvider = (*recursiveTTUObjectProvider)(nil)

func (c *recursiveTTUObjectProvider) End() {
	if c.cancel != nil {
		c.cancel()
	}
}

func (c *recursiveTTUObjectProvider) Begin(ctx context.Context, req *ResolveCheckRequest) (<-chan usersetMessage, error) {
	objectType := tuple.GetType(req.GetTupleKey().GetObject())

	possibleParents, err := c.ts.GetDirectlyRelatedUserTypes(objectType, c.tuplesetRelation)
	if err != nil {
		return nil, err
	}

	leftChans, err := produceLeftChannels(ctx, req, possibleParents, checkutil.BuildTTUV2RelationFunc(c.computedRelation))
	if err != nil {
		return nil, err
	}
	outChannel := make(chan usersetMessage, len(leftChans))
	ctx, cancel := context.WithCancel(ctx)
	c.cancel = cancel
	go iteratorsToUserset(ctx, leftChans, outChannel)
	return outChannel, nil
}

type recursiveUsersetObjectProvider struct {
	ts     *typesystem.TypeSystem
	cancel context.CancelFunc
}

func newRecursiveUsersetObjectProvider(ts *typesystem.TypeSystem) *recursiveUsersetObjectProvider {
	return &recursiveUsersetObjectProvider{ts: ts}
}

var _ objectProvider = (*recursiveUsersetObjectProvider)(nil)

func (c *recursiveUsersetObjectProvider) End() {
	if c.cancel != nil {
		c.cancel()
	}
}

func (c *recursiveUsersetObjectProvider) Begin(ctx context.Context, req *ResolveCheckRequest) (<-chan usersetMessage, error) {
	objectType := tuple.GetType(req.GetTupleKey().GetObject())
	reference := []*openfgav1.RelationReference{{Type: objectType, RelationOrWildcard: &openfgav1.RelationReference_Relation{Relation: req.GetTupleKey().GetRelation()}}}

	leftChans, err := produceLeftChannels(ctx, req, reference, checkutil.BuildUsersetV2RelationFunc())
	if err != nil {
		return nil, err
	}
	outChannel := make(chan usersetMessage, len(leftChans))
	ctx, cancel := context.WithCancel(ctx)
	c.cancel = cancel
	go iteratorsToUserset(ctx, leftChans, outChannel)
	return outChannel, nil
}

// TODO: This should be iteratorsToObjectID since ultimately, the mapper was already applied and its just and ObjectID.
func iteratorsToUserset(ctx context.Context, chans []<-chan *iterator.Msg, out chan usersetMessage) {
	if len(chans) == 0 {
		close(out)
		return
	}

	pool := concurrency.NewPool(ctx, len(chans))

	for _, c := range chans {
		pool.Go(func(ctx context.Context) error {
			open := true
			defer func() {
				if open {
					iterator.Drain(c)
				}
			}()
			for {
				select {
				case <-ctx.Done():
					return ErrShortCircuit
				case msg, ok := <-c:
					if !ok {
						open = false
						return nil
					}
					if msg.Err != nil {
						concurrency.TrySendThroughChannel(ctx, usersetMessage{err: msg.Err}, out)
						return ErrShortCircuit
					}
					for {
						t, err := msg.Iter.Next(ctx)
						if err != nil {
							msg.Iter.Stop()
							if storage.IterIsDoneOrCancelled(err) {
								if errors.Is(err, storage.ErrIteratorDone) {
									break
								}
								return ErrShortCircuit
							}
							concurrency.TrySendThroughChannel(ctx, usersetMessage{err: err}, out)
							break
						}
						concurrency.TrySendThroughChannel(ctx, usersetMessage{userset: t}, out)
					}
				}
			}
		})
	}

	go func() {
		_ = pool.Wait()
		close(out)
	}()
}
