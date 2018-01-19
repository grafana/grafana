// Copyright 2017 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package firestore

import (
	"errors"
	"fmt"
	"io"
	"math"
	"reflect"

	"golang.org/x/net/context"

	pb "google.golang.org/genproto/googleapis/firestore/v1beta1"

	"github.com/golang/protobuf/ptypes/wrappers"
	"google.golang.org/api/iterator"
)

// Query represents a Firestore query.
//
// Query values are immutable. Each Query method creates
// a new Query; it does not modify the old.
type Query struct {
	c                      *Client
	parentPath             string // path of the collection's parent
	collectionID           string
	selection              []FieldPath
	filters                []filter
	orders                 []order
	offset                 int32
	limit                  *wrappers.Int32Value
	startVals, endVals     []interface{}
	startBefore, endBefore bool
	err                    error
}

// DocumentID is the special field name representing the ID of a document
// in queries.
const DocumentID = "__name__"

// Select returns a new Query that specifies the paths
// to return from the result documents.
// Each path argument can be a single field or a dot-separated sequence of
// fields, and must not contain any of the runes "˜*/[]".
func (q Query) Select(paths ...string) Query {
	var fps []FieldPath
	for _, s := range paths {
		fp, err := parseDotSeparatedString(s)
		if err != nil {
			q.err = err
			return q
		}
		fps = append(fps, fp)
	}
	if fps == nil {
		q.selection = []FieldPath{{DocumentID}}
	} else {
		q.selection = fps
	}
	return q
}

// SelectPaths returns a new Query that specifies the field paths
// to return from the result documents.
func (q Query) SelectPaths(fieldPaths ...FieldPath) Query {
	q.selection = fieldPaths
	return q
}

// Where returns a new Query that filters the set of results.
// A Query can have multiple filters.
// The path argument can be a single field or a dot-separated sequence of
// fields, and must not contain any of the runes "˜*/[]".
// The op argument must be one of "==", "<", "<=", ">" or ">=".
func (q Query) Where(path, op string, value interface{}) Query {
	fp, err := parseDotSeparatedString(path)
	if err != nil {
		q.err = err
		return q
	}
	q.filters = append(append([]filter(nil), q.filters...), filter{fp, op, value})
	return q
}

// WherePath returns a new Query that filters the set of results.
// A Query can have multiple filters.
// The op argument must be one of "==", "<", "<=", ">" or ">=".
func (q Query) WherePath(fp FieldPath, op string, value interface{}) Query {
	q.filters = append(append([]filter(nil), q.filters...), filter{fp, op, value})
	return q
}

// Direction is the sort direction for result ordering.
type Direction int32

const (
	// Asc sorts results from smallest to largest.
	Asc Direction = Direction(pb.StructuredQuery_ASCENDING)

	// Desc sorts results from largest to smallest.
	Desc Direction = Direction(pb.StructuredQuery_DESCENDING)
)

// OrderBy returns a new Query that specifies the order in which results are
// returned. A Query can have multiple OrderBy/OrderByPath specifications. OrderBy
// appends the specification to the list of existing ones.
//
// The path argument can be a single field or a dot-separated sequence of
// fields, and must not contain any of the runes "˜*/[]".
//
// To order by document name, use the special field path DocumentID.
func (q Query) OrderBy(path string, dir Direction) Query {
	fp, err := parseDotSeparatedString(path)
	if err != nil {
		q.err = err
		return q
	}
	q.orders = append(append([]order(nil), q.orders...), order{fp, dir})
	return q
}

// OrderByPath returns a new Query that specifies the order in which results are
// returned. A Query can have multiple OrderBy/OrderByPath specifications.
// OrderByPath appends the specification to the list of existing ones.
func (q Query) OrderByPath(fp FieldPath, dir Direction) Query {
	q.orders = append(append([]order(nil), q.orders...), order{fp, dir})
	return q
}

// Offset returns a new Query that specifies the number of initial results to skip.
// It must not be negative.
func (q Query) Offset(n int) Query {
	q.offset = trunc32(n)
	return q
}

// Limit returns a new Query that specifies the maximum number of results to return.
// It must not be negative.
func (q Query) Limit(n int) Query {
	q.limit = &wrappers.Int32Value{trunc32(n)}
	return q
}

// StartAt returns a new Query that specifies that results should start at
// the document with the given field values. The field path corresponding to
// each value is taken from the corresponding OrderBy call. For example, in
//   q.OrderBy("X", Asc).OrderBy("Y", Desc).StartAt(1, 2)
// results will begin at the first document where X = 1 and Y = 2.
//
// If an OrderBy call uses the special DocumentID field path, the corresponding value
// should be the document ID relative to the query's collection. For example, to
// start at the document "NewYork" in the "States" collection, write
//
//   client.Collection("States").OrderBy(DocumentID, firestore.Asc).StartAt("NewYork")
//
// Calling StartAt overrides a previous call to StartAt or StartAfter.
func (q Query) StartAt(fieldValues ...interface{}) Query {
	q.startVals, q.startBefore = fieldValues, true
	return q
}

// StartAfter returns a new Query that specifies that results should start just after
// the document with the given field values. See Query.StartAt for more information.
//
// Calling StartAfter overrides a previous call to StartAt or StartAfter.
func (q Query) StartAfter(fieldValues ...interface{}) Query {
	q.startVals, q.startBefore = fieldValues, false
	return q
}

// EndAt returns a new Query that specifies that results should end at the
// document with the given field values. See Query.StartAt for more information.
//
// Calling EndAt overrides a previous call to EndAt or EndBefore.
func (q Query) EndAt(fieldValues ...interface{}) Query {
	q.endVals, q.endBefore = fieldValues, false
	return q
}

// EndBefore returns a new Query that specifies that results should end just before
// the document with the given field values. See Query.StartAt for more information.
//
// Calling EndBefore overrides a previous call to EndAt or EndBefore.
func (q Query) EndBefore(fieldValues ...interface{}) Query {
	q.endVals, q.endBefore = fieldValues, true
	return q
}

func (q Query) query() *Query { return &q }

func (q Query) toProto() (*pb.StructuredQuery, error) {
	if q.err != nil {
		return nil, q.err
	}
	if q.collectionID == "" {
		return nil, errors.New("firestore: query created without CollectionRef")
	}
	p := &pb.StructuredQuery{
		From:   []*pb.StructuredQuery_CollectionSelector{{CollectionId: q.collectionID}},
		Offset: q.offset,
		Limit:  q.limit,
	}
	if len(q.selection) > 0 {
		p.Select = &pb.StructuredQuery_Projection{}
		for _, fp := range q.selection {
			if err := fp.validate(); err != nil {
				return nil, err
			}
			p.Select.Fields = append(p.Select.Fields, fref(fp))
		}
	}
	// If there is only filter, use it directly. Otherwise, construct
	// a CompositeFilter.
	if len(q.filters) == 1 {
		pf, err := q.filters[0].toProto()
		if err != nil {
			return nil, err
		}
		p.Where = pf
	} else if len(q.filters) > 1 {
		cf := &pb.StructuredQuery_CompositeFilter{
			Op: pb.StructuredQuery_CompositeFilter_AND,
		}
		p.Where = &pb.StructuredQuery_Filter{
			FilterType: &pb.StructuredQuery_Filter_CompositeFilter{cf},
		}
		for _, f := range q.filters {
			pf, err := f.toProto()
			if err != nil {
				return nil, err
			}
			cf.Filters = append(cf.Filters, pf)
		}
	}
	for _, ord := range q.orders {
		po, err := ord.toProto()
		if err != nil {
			return nil, err
		}
		p.OrderBy = append(p.OrderBy, po)
	}
	// StartAt and EndAt must have values that correspond exactly to the explicit order-by fields.
	if len(q.startVals) != 0 {
		vals, err := q.toPositionValues(q.startVals)
		if err != nil {
			return nil, err
		}
		p.StartAt = &pb.Cursor{Values: vals, Before: q.startBefore}
	}
	if len(q.endVals) != 0 {
		vals, err := q.toPositionValues(q.endVals)
		if err != nil {
			return nil, err
		}
		p.EndAt = &pb.Cursor{Values: vals, Before: q.endBefore}
	}
	return p, nil
}

// toPositionValues converts the field values to protos.
func (q *Query) toPositionValues(fieldValues []interface{}) ([]*pb.Value, error) {
	if len(fieldValues) != len(q.orders) {
		return nil, errors.New("firestore: number of field values in StartAt/StartAfter/EndAt/EndBefore does not match number of OrderBy fields")
	}
	vals := make([]*pb.Value, len(fieldValues))
	var err error
	for i, ord := range q.orders {
		fval := fieldValues[i]
		if len(ord.fieldPath) == 1 && ord.fieldPath[0] == DocumentID {
			docID, ok := fval.(string)
			if !ok {
				return nil, fmt.Errorf("firestore: expected doc ID for DocumentID field, got %T", fval)
			}
			vals[i] = &pb.Value{&pb.Value_ReferenceValue{q.parentPath + "/documents/" + q.collectionID + "/" + docID}}
		} else {
			var sawTransform bool
			vals[i], sawTransform, err = toProtoValue(reflect.ValueOf(fval))
			if err != nil {
				return nil, err
			}
			if sawTransform {
				return nil, errors.New("firestore: ServerTimestamp disallowed in query value")
			}
		}
	}
	return vals, nil
}

type filter struct {
	fieldPath FieldPath
	op        string
	value     interface{}
}

func (f filter) toProto() (*pb.StructuredQuery_Filter, error) {
	if err := f.fieldPath.validate(); err != nil {
		return nil, err
	}
	var op pb.StructuredQuery_FieldFilter_Operator
	switch f.op {
	case "<":
		op = pb.StructuredQuery_FieldFilter_LESS_THAN
	case "<=":
		op = pb.StructuredQuery_FieldFilter_LESS_THAN_OR_EQUAL
	case ">":
		op = pb.StructuredQuery_FieldFilter_GREATER_THAN
	case ">=":
		op = pb.StructuredQuery_FieldFilter_GREATER_THAN_OR_EQUAL
	case "==":
		op = pb.StructuredQuery_FieldFilter_EQUAL
	default:
		return nil, fmt.Errorf("firestore: invalid operator %q", f.op)
	}
	val, sawTransform, err := toProtoValue(reflect.ValueOf(f.value))
	if err != nil {
		return nil, err
	}
	if sawTransform {
		return nil, errors.New("firestore: ServerTimestamp disallowed in query value")
	}
	return &pb.StructuredQuery_Filter{
		FilterType: &pb.StructuredQuery_Filter_FieldFilter{
			&pb.StructuredQuery_FieldFilter{
				Field: fref(f.fieldPath),
				Op:    op,
				Value: val,
			},
		},
	}, nil
}

type order struct {
	fieldPath FieldPath
	dir       Direction
}

func (r order) toProto() (*pb.StructuredQuery_Order, error) {
	if err := r.fieldPath.validate(); err != nil {
		return nil, err
	}
	return &pb.StructuredQuery_Order{
		Field:     fref(r.fieldPath),
		Direction: pb.StructuredQuery_Direction(r.dir),
	}, nil
}

func fref(fp FieldPath) *pb.StructuredQuery_FieldReference {
	return &pb.StructuredQuery_FieldReference{fp.toServiceFieldPath()}
}

func trunc32(i int) int32 {
	if i > math.MaxInt32 {
		i = math.MaxInt32
	}
	return int32(i)
}

// Documents returns an iterator over the query's resulting documents.
func (q Query) Documents(ctx context.Context) *DocumentIterator {
	return &DocumentIterator{
		ctx: withResourceHeader(ctx, q.c.path()),
		q:   &q,
		err: checkTransaction(ctx),
	}
}

// DocumentIterator is an iterator over documents returned by a query.
type DocumentIterator struct {
	ctx          context.Context
	q            *Query
	tid          []byte // transaction ID, if any
	streamClient pb.Firestore_RunQueryClient
	err          error
}

// Next returns the next result. Its second return value is iterator.Done if there
// are no more results. Once Next returns Done, all subsequent calls will return
// Done.
func (it *DocumentIterator) Next() (*DocumentSnapshot, error) {
	if it.err != nil {
		return nil, it.err
	}
	client := it.q.c
	if it.streamClient == nil {
		sq, err := it.q.toProto()
		if err != nil {
			it.err = err
			return nil, err
		}
		req := &pb.RunQueryRequest{
			Parent:    it.q.parentPath,
			QueryType: &pb.RunQueryRequest_StructuredQuery{sq},
		}
		if it.tid != nil {
			req.ConsistencySelector = &pb.RunQueryRequest_Transaction{it.tid}
		}
		it.streamClient, it.err = client.c.RunQuery(it.ctx, req)
		if it.err != nil {
			return nil, it.err
		}
	}
	var res *pb.RunQueryResponse
	var err error
	for {
		res, err = it.streamClient.Recv()
		if err == io.EOF {
			err = iterator.Done
		}
		if err != nil {
			it.err = err
			return nil, it.err
		}
		if res.Document != nil {
			break
		}
		// No document => partial progress; keep receiving.
	}
	docRef, err := pathToDoc(res.Document.Name, client)
	if err != nil {
		it.err = err
		return nil, err
	}
	doc, err := newDocumentSnapshot(docRef, res.Document, client)
	if err != nil {
		it.err = err
		return nil, err
	}
	return doc, nil
}

// GetAll returns all the documents remaining from the iterator.
func (it *DocumentIterator) GetAll() ([]*DocumentSnapshot, error) {
	var docs []*DocumentSnapshot
	for {
		doc, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		docs = append(docs, doc)
	}
	return docs, nil
}

// TODO(jba): Does the iterator need a Stop or Close method? I don't think so--
// I don't think the client can terminate a streaming receive except perhaps
// by cancelling the context, and the user can do that themselves if they wish.
// Find out for sure.
