// Copyright 2014 Google Inc. All Rights Reserved.
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

package datastore

import (
	"errors"
	"fmt"
	"log"
	"os"
	"reflect"

	"golang.org/x/net/context"
	"google.golang.org/api/option"
	gtransport "google.golang.org/api/transport/grpc"
	pb "google.golang.org/genproto/googleapis/datastore/v1"
	"google.golang.org/grpc"
)

const (
	prodAddr  = "datastore.googleapis.com:443"
	userAgent = "gcloud-golang-datastore/20160401"
)

// ScopeDatastore grants permissions to view and/or manage datastore entities
const ScopeDatastore = "https://www.googleapis.com/auth/datastore"

// resourcePrefixHeader is the name of the metadata header used to indicate
// the resource being operated on.
const resourcePrefixHeader = "google-cloud-resource-prefix"

// Client is a client for reading and writing data in a datastore dataset.
type Client struct {
	conn     *grpc.ClientConn
	client   pb.DatastoreClient
	endpoint string
	dataset  string // Called dataset by the datastore API, synonym for project ID.
}

// NewClient creates a new Client for a given dataset.
// If the project ID is empty, it is derived from the DATASTORE_PROJECT_ID environment variable.
// If the DATASTORE_EMULATOR_HOST environment variable is set, client will use its value
// to connect to a locally-running datastore emulator.
func NewClient(ctx context.Context, projectID string, opts ...option.ClientOption) (*Client, error) {
	var o []option.ClientOption
	// Environment variables for gcd emulator:
	// https://cloud.google.com/datastore/docs/tools/datastore-emulator
	// If the emulator is available, dial it directly (and don't pass any credentials).
	if addr := os.Getenv("DATASTORE_EMULATOR_HOST"); addr != "" {
		conn, err := grpc.Dial(addr, grpc.WithInsecure())
		if err != nil {
			return nil, fmt.Errorf("grpc.Dial: %v", err)
		}
		o = []option.ClientOption{option.WithGRPCConn(conn)}
	} else {
		o = []option.ClientOption{
			option.WithEndpoint(prodAddr),
			option.WithScopes(ScopeDatastore),
			option.WithUserAgent(userAgent),
		}
	}
	// Warn if we see the legacy emulator environment variables.
	if os.Getenv("DATASTORE_HOST") != "" && os.Getenv("DATASTORE_EMULATOR_HOST") == "" {
		log.Print("WARNING: legacy environment variable DATASTORE_HOST is ignored. Use DATASTORE_EMULATOR_HOST instead.")
	}
	if os.Getenv("DATASTORE_DATASET") != "" && os.Getenv("DATASTORE_PROJECT_ID") == "" {
		log.Print("WARNING: legacy environment variable DATASTORE_DATASET is ignored. Use DATASTORE_PROJECT_ID instead.")
	}
	if projectID == "" {
		projectID = os.Getenv("DATASTORE_PROJECT_ID")
	}
	if projectID == "" {
		return nil, errors.New("datastore: missing project/dataset id")
	}
	o = append(o, opts...)
	conn, err := gtransport.Dial(ctx, o...)
	if err != nil {
		return nil, fmt.Errorf("dialing: %v", err)
	}
	return &Client{
		conn:    conn,
		client:  newDatastoreClient(conn, projectID),
		dataset: projectID,
	}, nil

}

var (
	// ErrInvalidEntityType is returned when functions like Get or Next are
	// passed a dst or src argument of invalid type.
	ErrInvalidEntityType = errors.New("datastore: invalid entity type")
	// ErrInvalidKey is returned when an invalid key is presented.
	ErrInvalidKey = errors.New("datastore: invalid key")
	// ErrNoSuchEntity is returned when no entity was found for a given key.
	ErrNoSuchEntity = errors.New("datastore: no such entity")
)

type multiArgType int

const (
	multiArgTypeInvalid multiArgType = iota
	multiArgTypePropertyLoadSaver
	multiArgTypeStruct
	multiArgTypeStructPtr
	multiArgTypeInterface
)

// ErrFieldMismatch is returned when a field is to be loaded into a different
// type than the one it was stored from, or when a field is missing or
// unexported in the destination struct.
// StructType is the type of the struct pointed to by the destination argument
// passed to Get or to Iterator.Next.
type ErrFieldMismatch struct {
	StructType reflect.Type
	FieldName  string
	Reason     string
}

func (e *ErrFieldMismatch) Error() string {
	return fmt.Sprintf("datastore: cannot load field %q into a %q: %s",
		e.FieldName, e.StructType, e.Reason)
}

// GeoPoint represents a location as latitude/longitude in degrees.
type GeoPoint struct {
	Lat, Lng float64
}

// Valid returns whether a GeoPoint is within [-90, 90] latitude and [-180, 180] longitude.
func (g GeoPoint) Valid() bool {
	return -90 <= g.Lat && g.Lat <= 90 && -180 <= g.Lng && g.Lng <= 180
}

func keyToProto(k *Key) *pb.Key {
	if k == nil {
		return nil
	}

	var path []*pb.Key_PathElement
	for {
		el := &pb.Key_PathElement{Kind: k.Kind}
		if k.ID != 0 {
			el.IdType = &pb.Key_PathElement_Id{Id: k.ID}
		} else if k.Name != "" {
			el.IdType = &pb.Key_PathElement_Name{Name: k.Name}
		}
		path = append(path, el)
		if k.Parent == nil {
			break
		}
		k = k.Parent
	}

	// The path should be in order [grandparent, parent, child]
	// We did it backward above, so reverse back.
	for i := 0; i < len(path)/2; i++ {
		path[i], path[len(path)-i-1] = path[len(path)-i-1], path[i]
	}

	key := &pb.Key{Path: path}
	if k.Namespace != "" {
		key.PartitionId = &pb.PartitionId{
			NamespaceId: k.Namespace,
		}
	}
	return key
}

// protoToKey decodes a protocol buffer representation of a key into an
// equivalent *Key object. If the key is invalid, protoToKey will return the
// invalid key along with ErrInvalidKey.
func protoToKey(p *pb.Key) (*Key, error) {
	var key *Key
	var namespace string
	if partition := p.PartitionId; partition != nil {
		namespace = partition.NamespaceId
	}
	for _, el := range p.Path {
		key = &Key{
			Namespace: namespace,
			Kind:      el.Kind,
			ID:        el.GetId(),
			Name:      el.GetName(),
			Parent:    key,
		}
	}
	if !key.valid() { // Also detects key == nil.
		return key, ErrInvalidKey
	}
	return key, nil
}

// multiKeyToProto is a batch version of keyToProto.
func multiKeyToProto(keys []*Key) []*pb.Key {
	ret := make([]*pb.Key, len(keys))
	for i, k := range keys {
		ret[i] = keyToProto(k)
	}
	return ret
}

// multiKeyToProto is a batch version of keyToProto.
func multiProtoToKey(keys []*pb.Key) ([]*Key, error) {
	hasErr := false
	ret := make([]*Key, len(keys))
	err := make(MultiError, len(keys))
	for i, k := range keys {
		ret[i], err[i] = protoToKey(k)
		if err[i] != nil {
			hasErr = true
		}
	}
	if hasErr {
		return nil, err
	}
	return ret, nil
}

// multiValid is a batch version of Key.valid. It returns an error, not a
// []bool.
func multiValid(key []*Key) error {
	invalid := false
	for _, k := range key {
		if !k.valid() {
			invalid = true
			break
		}
	}
	if !invalid {
		return nil
	}
	err := make(MultiError, len(key))
	for i, k := range key {
		if !k.valid() {
			err[i] = ErrInvalidKey
		}
	}
	return err
}

// checkMultiArg checks that v has type []S, []*S, []I, or []P, for some struct
// type S, for some interface type I, or some non-interface non-pointer type P
// such that P or *P implements PropertyLoadSaver.
//
// It returns what category the slice's elements are, and the reflect.Type
// that represents S, I or P.
//
// As a special case, PropertyList is an invalid type for v.
//
// TODO(djd): multiArg is very confusing. Fold this logic into the
// relevant Put/Get methods to make the logic less opaque.
func checkMultiArg(v reflect.Value) (m multiArgType, elemType reflect.Type) {
	if v.Kind() != reflect.Slice {
		return multiArgTypeInvalid, nil
	}
	if v.Type() == typeOfPropertyList {
		return multiArgTypeInvalid, nil
	}
	elemType = v.Type().Elem()
	if reflect.PtrTo(elemType).Implements(typeOfPropertyLoadSaver) {
		return multiArgTypePropertyLoadSaver, elemType
	}
	switch elemType.Kind() {
	case reflect.Struct:
		return multiArgTypeStruct, elemType
	case reflect.Interface:
		return multiArgTypeInterface, elemType
	case reflect.Ptr:
		elemType = elemType.Elem()
		if elemType.Kind() == reflect.Struct {
			return multiArgTypeStructPtr, elemType
		}
	}
	return multiArgTypeInvalid, nil
}

// Close closes the Client.
func (c *Client) Close() error {
	return c.conn.Close()
}

// Get loads the entity stored for key into dst, which must be a struct pointer
// or implement PropertyLoadSaver. If there is no such entity for the key, Get
// returns ErrNoSuchEntity.
//
// The values of dst's unmatched struct fields are not modified, and matching
// slice-typed fields are not reset before appending to them. In particular, it
// is recommended to pass a pointer to a zero valued struct on each Get call.
//
// ErrFieldMismatch is returned when a field is to be loaded into a different
// type than the one it was stored from, or when a field is missing or
// unexported in the destination struct. ErrFieldMismatch is only returned if
// dst is a struct pointer.
func (c *Client) Get(ctx context.Context, key *Key, dst interface{}) error {
	if dst == nil { // get catches nil interfaces; we need to catch nil ptr here
		return ErrInvalidEntityType
	}
	err := c.get(ctx, []*Key{key}, []interface{}{dst}, nil)
	if me, ok := err.(MultiError); ok {
		return me[0]
	}
	return err
}

// GetMulti is a batch version of Get.
//
// dst must be a []S, []*S, []I or []P, for some struct type S, some interface
// type I, or some non-interface non-pointer type P such that P or *P
// implements PropertyLoadSaver. If an []I, each element must be a valid dst
// for Get: it must be a struct pointer or implement PropertyLoadSaver.
//
// As a special case, PropertyList is an invalid type for dst, even though a
// PropertyList is a slice of structs. It is treated as invalid to avoid being
// mistakenly passed when []PropertyList was intended.
func (c *Client) GetMulti(ctx context.Context, keys []*Key, dst interface{}) error {
	return c.get(ctx, keys, dst, nil)
}

func (c *Client) get(ctx context.Context, keys []*Key, dst interface{}, opts *pb.ReadOptions) error {
	v := reflect.ValueOf(dst)
	multiArgType, _ := checkMultiArg(v)

	// Sanity checks
	if multiArgType == multiArgTypeInvalid {
		return errors.New("datastore: dst has invalid type")
	}
	if len(keys) != v.Len() {
		return errors.New("datastore: keys and dst slices have different length")
	}
	if len(keys) == 0 {
		return nil
	}

	// Go through keys, validate them, serialize then, and create a dict mapping them to their indices.
	// Equal keys are deduped.
	multiErr, any := make(MultiError, len(keys)), false
	keyMap := make(map[string][]int, len(keys))
	pbKeys := make([]*pb.Key, 0, len(keys))
	for i, k := range keys {
		if !k.valid() {
			multiErr[i] = ErrInvalidKey
			any = true
		} else {
			ks := k.String()
			if _, ok := keyMap[ks]; !ok {
				pbKeys = append(pbKeys, keyToProto(k))
			}
			keyMap[ks] = append(keyMap[ks], i)
		}
	}
	if any {
		return multiErr
	}
	req := &pb.LookupRequest{
		ProjectId:   c.dataset,
		Keys:        pbKeys,
		ReadOptions: opts,
	}
	resp, err := c.client.Lookup(ctx, req)
	if err != nil {
		return err
	}
	found := resp.Found
	missing := resp.Missing
	// Upper bound 100 iterations to prevent infinite loop.
	// We choose 100 iterations somewhat logically:
	// Max number of Entities you can request from Datastore is 1,000.
	// Max size for a Datastore Entity is 1 MiB.
	// Max request size is 10 MiB, so we assume max response size is also 10 MiB.
	// 1,000 / 10 = 100.
	// Note that if ctx has a deadline, the deadline will probably
	// be hit before we reach 100 iterations.
	for i := 0; len(resp.Deferred) > 0 && i < 100; i++ {
		req.Keys = resp.Deferred
		resp, err = c.client.Lookup(ctx, req)
		if err != nil {
			return err
		}
		found = append(found, resp.Found...)
		missing = append(missing, resp.Missing...)
	}

	filled := 0
	for _, e := range found {
		k, err := protoToKey(e.Entity.Key)
		if err != nil {
			return errors.New("datastore: internal error: server returned an invalid key")
		}
		filled += len(keyMap[k.String()])
		for _, index := range keyMap[k.String()] {
			elem := v.Index(index)
			if multiArgType == multiArgTypePropertyLoadSaver || multiArgType == multiArgTypeStruct {
				elem = elem.Addr()
			}
			if multiArgType == multiArgTypeStructPtr && elem.IsNil() {
				elem.Set(reflect.New(elem.Type().Elem()))
			}
			if err := loadEntityProto(elem.Interface(), e.Entity); err != nil {
				multiErr[index] = err
				any = true
			}
		}
	}
	for _, e := range missing {
		k, err := protoToKey(e.Entity.Key)
		if err != nil {
			return errors.New("datastore: internal error: server returned an invalid key")
		}
		filled += len(keyMap[k.String()])
		for _, index := range keyMap[k.String()] {
			multiErr[index] = ErrNoSuchEntity
		}
		any = true
	}

	if filled != len(keys) {
		return errors.New("datastore: internal error: server returned the wrong number of entities")
	}

	if any {
		return multiErr
	}
	return nil
}

// Put saves the entity src into the datastore with key k. src must be a struct
// pointer or implement PropertyLoadSaver; if a struct pointer then any
// unexported fields of that struct will be skipped. If k is an incomplete key,
// the returned key will be a unique key generated by the datastore.
func (c *Client) Put(ctx context.Context, key *Key, src interface{}) (*Key, error) {
	k, err := c.PutMulti(ctx, []*Key{key}, []interface{}{src})
	if err != nil {
		if me, ok := err.(MultiError); ok {
			return nil, me[0]
		}
		return nil, err
	}
	return k[0], nil
}

// PutMulti is a batch version of Put.
//
// src must satisfy the same conditions as the dst argument to GetMulti.
func (c *Client) PutMulti(ctx context.Context, keys []*Key, src interface{}) ([]*Key, error) {
	mutations, err := putMutations(keys, src)
	if err != nil {
		return nil, err
	}

	// Make the request.
	req := &pb.CommitRequest{
		ProjectId: c.dataset,
		Mutations: mutations,
		Mode:      pb.CommitRequest_NON_TRANSACTIONAL,
	}
	resp, err := c.client.Commit(ctx, req)
	if err != nil {
		return nil, err
	}

	// Copy any newly minted keys into the returned keys.
	ret := make([]*Key, len(keys))
	for i, key := range keys {
		if key.Incomplete() {
			// This key is in the mutation results.
			ret[i], err = protoToKey(resp.MutationResults[i].Key)
			if err != nil {
				return nil, errors.New("datastore: internal error: server returned an invalid key")
			}
		} else {
			ret[i] = key
		}
	}
	return ret, nil
}

func putMutations(keys []*Key, src interface{}) ([]*pb.Mutation, error) {
	v := reflect.ValueOf(src)
	multiArgType, _ := checkMultiArg(v)
	if multiArgType == multiArgTypeInvalid {
		return nil, errors.New("datastore: src has invalid type")
	}
	if len(keys) != v.Len() {
		return nil, errors.New("datastore: key and src slices have different length")
	}
	if len(keys) == 0 {
		return nil, nil
	}
	if err := multiValid(keys); err != nil {
		return nil, err
	}
	mutations := make([]*pb.Mutation, 0, len(keys))
	multiErr := make(MultiError, len(keys))
	hasErr := false
	for i, k := range keys {
		elem := v.Index(i)
		// Two cases where we need to take the address:
		// 1) multiArgTypePropertyLoadSaver => &elem implements PLS
		// 2) multiArgTypeStruct => saveEntity needs *struct
		if multiArgType == multiArgTypePropertyLoadSaver || multiArgType == multiArgTypeStruct {
			elem = elem.Addr()
		}
		p, err := saveEntity(k, elem.Interface())
		if err != nil {
			multiErr[i] = err
			hasErr = true
		}
		var mut *pb.Mutation
		if k.Incomplete() {
			mut = &pb.Mutation{Operation: &pb.Mutation_Insert{Insert: p}}
		} else {
			mut = &pb.Mutation{Operation: &pb.Mutation_Upsert{Upsert: p}}
		}
		mutations = append(mutations, mut)
	}
	if hasErr {
		return nil, multiErr
	}
	return mutations, nil
}

// Delete deletes the entity for the given key.
func (c *Client) Delete(ctx context.Context, key *Key) error {
	err := c.DeleteMulti(ctx, []*Key{key})
	if me, ok := err.(MultiError); ok {
		return me[0]
	}
	return err
}

// DeleteMulti is a batch version of Delete.
func (c *Client) DeleteMulti(ctx context.Context, keys []*Key) error {
	mutations, err := deleteMutations(keys)
	if err != nil {
		return err
	}

	req := &pb.CommitRequest{
		ProjectId: c.dataset,
		Mutations: mutations,
		Mode:      pb.CommitRequest_NON_TRANSACTIONAL,
	}
	_, err = c.client.Commit(ctx, req)
	return err
}

func deleteMutations(keys []*Key) ([]*pb.Mutation, error) {
	mutations := make([]*pb.Mutation, 0, len(keys))
	set := make(map[string]bool, len(keys))
	for _, k := range keys {
		if k.Incomplete() {
			return nil, fmt.Errorf("datastore: can't delete the incomplete key: %v", k)
		}
		ks := k.String()
		if !set[ks] {
			mutations = append(mutations, &pb.Mutation{
				Operation: &pb.Mutation_Delete{Delete: keyToProto(k)},
			})
		}
		set[ks] = true
	}
	return mutations, nil
}
