package storage

import (
	"context"
	"fmt"
	"sync"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/tuple"
)

type TupleMapperFunc func(t *openfgav1.Tuple) string

func UserMapper() TupleMapperFunc {
	return func(t *openfgav1.Tuple) string {
		return t.GetKey().GetUser()
	}
}

func ObjectMapper() TupleMapperFunc {
	return func(t *openfgav1.Tuple) string {
		return t.GetKey().GetObject()
	}
}

type TupleMapperKind int64

const (
	// UsersetKind is a mapper that returns the userset ID from the tuple's user field.
	UsersetKind TupleMapperKind = iota
	// TTUKind is a mapper that returns the user field of the tuple.
	TTUKind
	// ObjectIDKind is mapper that returns the object field of the tuple.
	ObjectIDKind
)

// TupleMapper is an iterator that, on calls to Next and Head, returns a mapping of the tuple.
type TupleMapper interface {
	Iterator[string]
}

type UsersetMapper struct {
	iter TupleKeyIterator
	once *sync.Once
}

var _ TupleMapper = (*UsersetMapper)(nil)

func (n UsersetMapper) Next(ctx context.Context) (string, error) {
	tupleRes, err := n.iter.Next(ctx)
	if err != nil {
		return "", err
	}
	return n.doMap(tupleRes)
}

func (n UsersetMapper) Stop() {
	n.once.Do(func() {
		n.iter.Stop()
	})
}

func (n UsersetMapper) Head(ctx context.Context) (string, error) {
	tupleRes, err := n.iter.Head(ctx)
	if err != nil {
		return "", err
	}
	return n.doMap(tupleRes)
}

func (n UsersetMapper) doMap(t *openfgav1.TupleKey) (string, error) {
	usersetName, relation := tuple.SplitObjectRelation(t.GetUser())
	if relation == "" && !tuple.IsWildcard(usersetName) {
		// This should never happen because ReadUsersetTuples only returns usersets as users.
		return "", fmt.Errorf("unexpected userset %s with no relation", t.GetUser())
	}
	return usersetName, nil
}

type TTUMapper struct {
	iter TupleKeyIterator
	once *sync.Once
}

var _ TupleMapper = (*TTUMapper)(nil)

func (n TTUMapper) Next(ctx context.Context) (string, error) {
	tupleRes, err := n.iter.Next(ctx)
	if err != nil {
		return "", err
	}
	return n.doMap(tupleRes)
}

func (n TTUMapper) Stop() {
	n.once.Do(func() {
		n.iter.Stop()
	})
}

func (n TTUMapper) Head(ctx context.Context) (string, error) {
	tupleRes, err := n.iter.Head(ctx)
	if err != nil {
		return "", err
	}
	return n.doMap(tupleRes)
}

func (n TTUMapper) doMap(t *openfgav1.TupleKey) (string, error) {
	return t.GetUser(), nil
}

type ObjectIDMapper struct {
	iter TupleKeyIterator
	once *sync.Once
}

var _ TupleMapper = (*ObjectIDMapper)(nil)

func (n ObjectIDMapper) Next(ctx context.Context) (string, error) {
	tupleRes, err := n.iter.Next(ctx)
	if err != nil {
		return "", err
	}
	return n.doMap(tupleRes)
}

func (n ObjectIDMapper) Stop() {
	n.once.Do(func() {
		n.iter.Stop()
	})
}

func (n ObjectIDMapper) Head(ctx context.Context) (string, error) {
	tupleRes, err := n.iter.Head(ctx)
	if err != nil {
		return "", err
	}
	return n.doMap(tupleRes)
}

func (n ObjectIDMapper) doMap(t *openfgav1.TupleKey) (string, error) {
	return t.GetObject(), nil
}

func WrapIterator(kind TupleMapperKind, iter TupleKeyIterator) TupleMapper {
	switch kind {
	case UsersetKind:
		return &UsersetMapper{iter: iter, once: &sync.Once{}}
	case TTUKind:
		return &TTUMapper{iter: iter, once: &sync.Once{}}
	case ObjectIDKind:
		return &ObjectIDMapper{iter: iter, once: &sync.Once{}}
	}
	return nil
}
