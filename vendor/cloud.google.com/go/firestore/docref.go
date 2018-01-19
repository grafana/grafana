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
	"reflect"
	"sort"

	"golang.org/x/net/context"
	"google.golang.org/api/iterator"

	vkit "cloud.google.com/go/firestore/apiv1beta1"
	pb "google.golang.org/genproto/googleapis/firestore/v1beta1"
)

var errNilDocRef = errors.New("firestore: nil DocumentRef")

// A DocumentRef is a reference to a Firestore document.
type DocumentRef struct {
	// The CollectionRef that this document is a part of. Never nil.
	Parent *CollectionRef

	// The full resource path of the document: "projects/P/databases/D/documents..."
	Path string

	// The ID of the document: the last component of the resource path.
	ID string
}

func newDocRef(parent *CollectionRef, id string) *DocumentRef {
	return &DocumentRef{
		Parent: parent,
		ID:     id,
		Path:   parent.Path + "/" + id,
	}
}

// Collection returns a reference to sub-collection of this document.
func (d *DocumentRef) Collection(id string) *CollectionRef {
	return newCollRefWithParent(d.Parent.c, d, id)
}

// Get retrieves the document. It returns an error if the document does not exist.
func (d *DocumentRef) Get(ctx context.Context) (*DocumentSnapshot, error) {
	if err := checkTransaction(ctx); err != nil {
		return nil, err
	}
	if d == nil {
		return nil, errNilDocRef
	}
	doc, err := d.Parent.c.c.GetDocument(withResourceHeader(ctx, d.Parent.c.path()),
		&pb.GetDocumentRequest{Name: d.Path})
	// TODO(jba): verify that GetDocument returns NOT_FOUND.
	if err != nil {
		return nil, err
	}
	return newDocumentSnapshot(d, doc, d.Parent.c)
}

// Create creates the document with the given data.
// It returns an error if a document with the same ID already exists.
//
// The data argument can be a map with string keys, a struct, or a pointer to a
// struct. The map keys or exported struct fields become the fields of the firestore
// document.
// The values of data are converted to Firestore values as follows:
//
//   - bool converts to Bool.
//   - string converts to String.
//   - int, int8, int16, int32 and int64 convert to Integer.
//   - uint8, uint16 and uint32 convert to Integer. uint64 is disallowed,
//     because it can represent values that cannot be represented in an int64, which
//     is the underlying type of a Integer.
//   - float32 and float64 convert to Double.
//   - []byte converts to Bytes.
//   - time.Time converts to Timestamp.
//   - latlng.LatLng converts to GeoPoint. latlng is the package
//     "google.golang.org/genproto/googleapis/type/latlng".
//   - Slices convert to Array.
//   - Maps and structs convert to Map.
//   - nils of any type convert to Null.
//
// Pointers and interface{} are also permitted, and their elements processed
// recursively.
//
// Struct fields can have tags like those used by the encoding/json package. Tags
// begin with "firestore:" and are followed by "-", meaning "ignore this field," or
// an alternative name for the field. Following the name, these comma-separated
// options may be provided:
//
//   - omitempty: Do not encode this field if it is empty. A value is empty
//     if it is a zero value, or an array, slice or map of length zero.
//   - serverTimestamp: The field must be of type time.Time. When writing, if
//     the field has the zero value, the server will populate the stored document with
//     the time that the request is processed.
func (d *DocumentRef) Create(ctx context.Context, data interface{}) (*WriteResult, error) {
	ws, err := d.newCreateWrites(data)
	if err != nil {
		return nil, err
	}
	return d.Parent.c.commit1(ctx, ws)
}

func (d *DocumentRef) newCreateWrites(data interface{}) ([]*pb.Write, error) {
	if d == nil {
		return nil, errNilDocRef
	}
	doc, serverTimestampPaths, err := toProtoDocument(data)
	if err != nil {
		return nil, err
	}
	doc.Name = d.Path
	pc, err := exists(false).preconditionProto()
	if err != nil {
		return nil, err
	}
	return d.newUpdateWithTransform(doc, nil, pc, serverTimestampPaths, false), nil
}

// Set creates or overwrites the document with the given data. See DocumentRef.Create
// for the acceptable values of data. Without options, Set overwrites the document
// completely. Specify one of the Merge options to preserve an existing document's
// fields.
func (d *DocumentRef) Set(ctx context.Context, data interface{}, opts ...SetOption) (*WriteResult, error) {
	ws, err := d.newSetWrites(data, opts)
	if err != nil {
		return nil, err
	}
	return d.Parent.c.commit1(ctx, ws)
}

func (d *DocumentRef) newSetWrites(data interface{}, opts []SetOption) ([]*pb.Write, error) {
	if d == nil {
		return nil, errNilDocRef
	}
	origFieldPaths, allPaths, err := processSetOptions(opts)
	if err != nil {
		return nil, err
	}
	doc, serverTimestampPaths, err := toProtoDocument(data)
	if err != nil {
		return nil, err
	}
	if len(origFieldPaths) > 0 {
		// Keep only data fields corresponding to the given field paths.
		doc.Fields = applyFieldPaths(doc.Fields, origFieldPaths, nil)
	}
	doc.Name = d.Path

	var fieldPaths []FieldPath
	if allPaths {
		// MergeAll was passed. Check that the data is a map, and extract its field paths.
		v := reflect.ValueOf(data)
		if v.Kind() != reflect.Map {
			return nil, errors.New("firestore: MergeAll can only be specified with map data")
		}
		fieldPaths = fieldPathsFromMap(v, nil)
	} else if len(origFieldPaths) > 0 {
		// Remove server timestamp paths that are not in the list of paths to merge.
		// Note: this is technically O(n^2), but it is unlikely that there is more
		// than one server timestamp path.
		serverTimestampPaths = removePathsIf(serverTimestampPaths, func(fp FieldPath) bool {
			return !fp.in(origFieldPaths)
		})
		// Remove server timestamp fields from fieldPaths. Those fields were removed
		// from the document by toProtoDocument, so they should not be in the update
		// mask.
		// Note: this is technically O(n^2), but it is unlikely that there is
		// more than one server timestamp path.
		fieldPaths = removePathsIf(origFieldPaths, func(fp FieldPath) bool {
			return fp.in(serverTimestampPaths)
		})
		// Check that all the remaining field paths in the merge option are in the document.
		for _, fp := range fieldPaths {
			if _, err := valueAtPath(fp, doc.Fields); err != nil {
				return nil, err
			}
		}
	}
	return d.newUpdateWithTransform(doc, fieldPaths, nil, serverTimestampPaths, len(opts) == 0), nil
}

// Delete deletes the document. If the document doesn't exist, it does nothing
// and returns no error.
func (d *DocumentRef) Delete(ctx context.Context, preconds ...Precondition) (*WriteResult, error) {
	ws, err := d.newDeleteWrites(preconds)
	if err != nil {
		return nil, err
	}
	return d.Parent.c.commit1(ctx, ws)
}

// Create a new map that contains only the field paths in fps.
func applyFieldPaths(fields map[string]*pb.Value, fps []FieldPath, root FieldPath) map[string]*pb.Value {
	r := map[string]*pb.Value{}
	for k, v := range fields {
		kpath := root.with(k)
		if kpath.in(fps) {
			r[k] = v
		} else if mv := v.GetMapValue(); mv != nil {
			if m2 := applyFieldPaths(mv.Fields, fps, kpath); m2 != nil {
				r[k] = &pb.Value{&pb.Value_MapValue{&pb.MapValue{m2}}}
			}
		}
	}
	if len(r) == 0 {
		return nil
	}
	return r
}

func fieldPathsFromMap(vmap reflect.Value, prefix FieldPath) []FieldPath {
	// vmap is a map and its keys are strings.
	// Each map key denotes a field; no splitting or escaping.
	var fps []FieldPath
	for _, k := range vmap.MapKeys() {
		v := vmap.MapIndex(k)
		fp := prefix.with(k.String())
		if vm := extractMap(v); vm.IsValid() {
			fps = append(fps, fieldPathsFromMap(vm, fp)...)
		} else if v.Interface() != ServerTimestamp {
			// ServerTimestamp fields do not go into the update mask.
			fps = append(fps, fp)
		}
	}
	return fps
}

func extractMap(v reflect.Value) reflect.Value {
	switch v.Kind() {
	case reflect.Map:
		return v
	case reflect.Interface:
		return extractMap(v.Elem())
	default:
		return reflect.Value{}
	}
}

// removePathsIf creates a new slice of FieldPaths that contains
// exactly those elements of fps for which pred returns false.
func removePathsIf(fps []FieldPath, pred func(FieldPath) bool) []FieldPath {
	var result []FieldPath
	for _, fp := range fps {
		if !pred(fp) {
			result = append(result, fp)
		}
	}
	return result
}

func (d *DocumentRef) newDeleteWrites(preconds []Precondition) ([]*pb.Write, error) {
	if d == nil {
		return nil, errNilDocRef
	}
	pc, err := processPreconditionsForDelete(preconds)
	if err != nil {
		return nil, err
	}
	return []*pb.Write{{
		Operation:       &pb.Write_Delete{d.Path},
		CurrentDocument: pc,
	}}, nil
}

func (d *DocumentRef) newUpdatePathWrites(updates []Update, preconds []Precondition) ([]*pb.Write, error) {
	if len(updates) == 0 {
		return nil, errors.New("firestore: no paths to update")
	}
	var fps []FieldPath
	var fpvs []fpv
	for _, u := range updates {
		v, err := u.process()
		if err != nil {
			return nil, err
		}
		fps = append(fps, v.fieldPath)
		fpvs = append(fpvs, v)
	}
	if err := checkNoDupOrPrefix(fps); err != nil {
		return nil, err
	}
	m := createMapFromUpdates(fpvs)
	return d.newUpdateWrites(m, fps, preconds)
}

// newUpdateWrites creates Write operations for an update.
func (d *DocumentRef) newUpdateWrites(data interface{}, fieldPaths []FieldPath, preconds []Precondition) ([]*pb.Write, error) {
	if d == nil {
		return nil, errNilDocRef
	}
	pc, err := processPreconditionsForUpdate(preconds)
	if err != nil {
		return nil, err
	}
	doc, serverTimestampPaths, err := toProtoDocument(data)
	if err != nil {
		return nil, err
	}
	doc.Name = d.Path
	return d.newUpdateWithTransform(doc, fieldPaths, pc, serverTimestampPaths, false), nil
}

var requestTimeTransform = &pb.DocumentTransform_FieldTransform_SetToServerValue{
	pb.DocumentTransform_FieldTransform_REQUEST_TIME,
}

// newUpdateWithTransform constructs operations for a commit. Most generally, it
// returns an update operation followed by a transform.
//
// If there are no serverTimestampPaths, the transform is omitted.
//
// If doc.Fields is empty, there are no updatePaths, and there is no precondition,
// the update is omitted, unless updateOnEmpty is true.
func (d *DocumentRef) newUpdateWithTransform(doc *pb.Document, updatePaths []FieldPath, pc *pb.Precondition, serverTimestampPaths []FieldPath, updateOnEmpty bool) []*pb.Write {
	// Remove server timestamp fields from updatePaths. Those fields were removed
	// from the document by toProtoDocument, so they should not be in the update
	// mask.
	// Note: this is technically O(n^2), but it is unlikely that there is
	// more than one server timestamp path.
	updatePaths = removePathsIf(updatePaths, func(fp FieldPath) bool {
		return fp.in(serverTimestampPaths)
	})
	var ws []*pb.Write
	if updateOnEmpty || len(doc.Fields) > 0 ||
		len(updatePaths) > 0 || (pc != nil && len(serverTimestampPaths) == 0) {
		var mask *pb.DocumentMask
		if len(updatePaths) > 0 {
			sfps := toServiceFieldPaths(updatePaths)
			sort.Strings(sfps) // TODO(jba): make tests pass without this
			mask = &pb.DocumentMask{FieldPaths: sfps}
		}
		w := &pb.Write{
			Operation:       &pb.Write_Update{doc},
			UpdateMask:      mask,
			CurrentDocument: pc,
		}
		ws = append(ws, w)
		pc = nil // If the precondition is in the write, we don't need it in the transform.
	}
	if len(serverTimestampPaths) > 0 || pc != nil {
		ws = append(ws, d.newTransform(serverTimestampPaths, pc))
	}
	return ws
}

func (d *DocumentRef) newTransform(serverTimestampFieldPaths []FieldPath, pc *pb.Precondition) *pb.Write {
	sort.Sort(byPath(serverTimestampFieldPaths)) // TODO(jba): make tests pass without this
	var fts []*pb.DocumentTransform_FieldTransform
	for _, p := range serverTimestampFieldPaths {
		fts = append(fts, &pb.DocumentTransform_FieldTransform{
			FieldPath:     p.toServiceFieldPath(),
			TransformType: requestTimeTransform,
		})
	}
	return &pb.Write{
		Operation: &pb.Write_Transform{
			&pb.DocumentTransform{
				Document:        d.Path,
				FieldTransforms: fts,
				// TODO(jba): should the transform have the same preconditions as the write?
			},
		},
		CurrentDocument: pc,
	}
}

type sentinel int

const (
	// Delete is used as a value in a call to UpdateMap to indicate that the
	// corresponding key should be deleted.
	Delete sentinel = iota

	// ServerTimestamp is used as a value in a call to UpdateMap to indicate that the
	// key's value should be set to the time at which the server processed
	// the request.
	ServerTimestamp
)

func (s sentinel) String() string {
	switch s {
	case Delete:
		return "Delete"
	case ServerTimestamp:
		return "ServerTimestamp"
	default:
		return "<?sentinel?>"
	}
}

func isStructOrStructPtr(x interface{}) bool {
	v := reflect.ValueOf(x)
	if v.Kind() == reflect.Struct {
		return true
	}
	if v.Kind() == reflect.Ptr && v.Elem().Kind() == reflect.Struct {
		return true
	}
	return false
}

// An Update describes an update to a value referred to by a path.
// An Update should have either a non-empty Path or a non-empty FieldPath,
// but not both.
//
// See DocumentRef.Create for acceptable values.
// To delete a field, specify firestore.Delete as the value.
type Update struct {
	Path      string // Will be split on dots, and must not contain any of "˜*/[]".
	FieldPath FieldPath
	Value     interface{}
}

// An fpv is a pair of validated FieldPath and value.
type fpv struct {
	fieldPath FieldPath
	value     interface{}
}

func (u *Update) process() (v fpv, err error) {
	if (u.Path != "") == (u.FieldPath != nil) {
		return v, fmt.Errorf("firestore: update %+v should have exactly one of Path or FieldPath", u)
	}
	fp := u.FieldPath
	if fp == nil {
		fp, err = parseDotSeparatedString(u.Path)
		if err != nil {
			return v, err
		}
	}
	if err := fp.validate(); err != nil {
		return v, err
	}
	return fpv{fp, u.Value}, nil
}

// Update updates the document. The values at the given
// field paths are replaced, but other fields of the stored document are untouched.
func (d *DocumentRef) Update(ctx context.Context, updates []Update, preconds ...Precondition) (*WriteResult, error) {
	ws, err := d.newUpdatePathWrites(updates, preconds)
	if err != nil {
		return nil, err
	}
	return d.Parent.c.commit1(ctx, ws)
}

// Collections returns an interator over the immediate sub-collections of the document.
func (d *DocumentRef) Collections(ctx context.Context) *CollectionIterator {
	client := d.Parent.c
	it := &CollectionIterator{
		err:    checkTransaction(ctx),
		client: client,
		parent: d,
		it: client.c.ListCollectionIds(
			withResourceHeader(ctx, client.path()),
			&pb.ListCollectionIdsRequest{Parent: d.Path}),
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.items) },
		func() interface{} { b := it.items; it.items = nil; return b })
	return it
}

// CollectionIterator is an iterator over sub-collections of a document.
type CollectionIterator struct {
	client   *Client
	parent   *DocumentRef
	it       *vkit.StringIterator
	pageInfo *iterator.PageInfo
	nextFunc func() error
	items    []*CollectionRef
	err      error
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *CollectionIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

// Next returns the next result. Its second return value is iterator.Done if there
// are no more results. Once Next returns Done, all subsequent calls will return
// Done.
func (it *CollectionIterator) Next() (*CollectionRef, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	item := it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *CollectionIterator) fetch(pageSize int, pageToken string) (string, error) {
	if it.err != nil {
		return "", it.err
	}
	return iterFetch(pageSize, pageToken, it.it.PageInfo(), func() error {
		id, err := it.it.Next()
		if err != nil {
			return err
		}
		var cr *CollectionRef
		if it.parent == nil {
			cr = newTopLevelCollRef(it.client, it.client.path(), id)
		} else {
			cr = newCollRefWithParent(it.client, it.parent, id)
		}
		it.items = append(it.items, cr)
		return nil
	})
}

// GetAll returns all the collections remaining from the iterator.
func (it *CollectionIterator) GetAll() ([]*CollectionRef, error) {
	var crs []*CollectionRef
	for {
		cr, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		crs = append(crs, cr)
	}
	return crs, nil
}

// Common fetch code for iterators that are backed by vkit iterators.
// TODO(jba): dedup with same function in logging/logadmin.
func iterFetch(pageSize int, pageToken string, pi *iterator.PageInfo, next func() error) (string, error) {
	pi.MaxSize = pageSize
	pi.Token = pageToken
	// Get one item, which will fill the buffer.
	if err := next(); err != nil {
		return "", err
	}
	// Collect the rest of the buffer.
	for pi.Remaining() > 0 {
		if err := next(); err != nil {
			return "", err
		}
	}
	return pi.Token, nil
}
