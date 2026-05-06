// Package tuple contains code to manipulate tuples and errors related to tuples.
package tuple

import (
	"fmt"
	"regexp"
	"strings"

	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

type Tuple openfgav1.TupleKey

func (t *Tuple) GetObject() string {
	return (*openfgav1.TupleKey)(t).GetObject()
}

func (t *Tuple) GetRelation() string {
	return (*openfgav1.TupleKey)(t).GetRelation()
}

func (t *Tuple) GetUser() string {
	return (*openfgav1.TupleKey)(t).GetUser()
}

func (t *Tuple) String() string {
	tk := (*openfgav1.TupleKey)(t)

	return tk.GetObject() +
		"#" +
		tk.GetRelation() +
		"@" +
		tk.GetUser()
}

func From(tk *openfgav1.TupleKey) *Tuple {
	return (*Tuple)(tk)
}

type TupleKeys []*openfgav1.TupleKey

// Len is a method that is required to implement the
// sort.Interface interface. Len returns the number
// of elements in the slice.
func (tk TupleKeys) Len() int {
	return len(tk)
}

// Less is a method that is required to implement the
// sort.Interface interface. Less returns true when the
// value at index i is less than the value at index j.
// Tuples are compared first by their object, then their
// relation, then their user, and finally their condition.
// If Less(i, j) returns false and Less(j, i) returns false,
// then the tuples are equal.
func (tk TupleKeys) Less(i, j int) bool {
	if tk[i].GetObject() != tk[j].GetObject() {
		return tk[i].GetObject() < tk[j].GetObject()
	}

	if tk[i].GetRelation() != tk[j].GetRelation() {
		return tk[i].GetRelation() < tk[j].GetRelation()
	}

	if tk[i].GetUser() != tk[j].GetUser() {
		return tk[i].GetUser() < tk[j].GetUser()
	}

	cond1 := tk[i].GetCondition()
	cond2 := tk[j].GetCondition()
	if (cond1 != nil || cond2 != nil) && cond1.GetName() != cond2.GetName() {
		return cond1.GetName() < cond2.GetName()
	}
	// Note: conditions also optionally have context structs, but we aren't sorting by context

	return true
}

// Swap is a method that is required to implement the
// sort.Interface interface. Swap exchanges the values
// at slice indexes i and j.
func (tk TupleKeys) Swap(i, j int) {
	tk[i], tk[j] = tk[j], tk[i]
}

type TupleWithCondition interface {
	TupleWithoutCondition
	GetCondition() *openfgav1.RelationshipCondition
}

type TupleWithoutCondition interface {
	GetUser() string
	GetObject() string
	GetRelation() string
	String() string
}

type UserType string

const (
	User     UserType = "user"
	UserSet  UserType = "userset"
	Wildcard          = "*"
)

var (
	userIDRegex   = regexp.MustCompile(`^[^:#\s]+$`)
	objectRegex   = regexp.MustCompile(`^[^:#\s]+:[^#:\s]+$`)
	userSetRegex  = regexp.MustCompile(`^[^:#\s]+:[^#:*\s]+#[^:#*\s]+$`)
	relationRegex = regexp.MustCompile(`^[^:#@\s]+$`)
)

func ConvertCheckRequestTupleKeyToTupleKey(tk *openfgav1.CheckRequestTupleKey) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		Object:   tk.GetObject(),
		Relation: tk.GetRelation(),
		User:     tk.GetUser(),
	}
}

func ConvertAssertionTupleKeyToTupleKey(tk *openfgav1.AssertionTupleKey) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		Object:   tk.GetObject(),
		Relation: tk.GetRelation(),
		User:     tk.GetUser(),
	}
}

func ConvertReadRequestTupleKeyToTupleKey(tk *openfgav1.ReadRequestTupleKey) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		Object:   tk.GetObject(),
		Relation: tk.GetRelation(),
		User:     tk.GetUser(),
	}
}

func TupleKeyToTupleKeyWithoutCondition(tk *openfgav1.TupleKey) *openfgav1.TupleKeyWithoutCondition {
	return &openfgav1.TupleKeyWithoutCondition{
		Object:   tk.GetObject(),
		Relation: tk.GetRelation(),
		User:     tk.GetUser(),
	}
}

func TupleKeyWithoutConditionToTupleKey(tk *openfgav1.TupleKeyWithoutCondition) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		Object:   tk.GetObject(),
		Relation: tk.GetRelation(),
		User:     tk.GetUser(),
	}
}

func TupleKeysWithoutConditionToTupleKeys(tks ...*openfgav1.TupleKeyWithoutCondition) []*openfgav1.TupleKey {
	converted := make([]*openfgav1.TupleKey, 0, len(tks))
	for _, tk := range tks {
		converted = append(converted, TupleKeyWithoutConditionToTupleKey(tk))
	}

	return converted
}

func NewTupleKey(object, relation, user string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		Object:   object,
		Relation: relation,
		User:     user,
	}
}

func NewTupleKeyWithCondition(
	object, relation, user, conditionName string,
	context *structpb.Struct,
) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		Object:    object,
		Relation:  relation,
		User:      user,
		Condition: NewRelationshipCondition(conditionName, context),
	}
}

func NewRelationshipCondition(name string, context *structpb.Struct) *openfgav1.RelationshipCondition {
	if name == "" {
		return nil
	}

	if context == nil {
		return &openfgav1.RelationshipCondition{
			Name:    name,
			Context: &structpb.Struct{},
		}
	}

	return &openfgav1.RelationshipCondition{
		Name:    name,
		Context: context,
	}
}

func NewAssertionTupleKey(object, relation, user string) *openfgav1.AssertionTupleKey {
	return &openfgav1.AssertionTupleKey{
		Object:   object,
		Relation: relation,
		User:     user,
	}
}

func NewCheckRequestTupleKey(object, relation, user string) *openfgav1.CheckRequestTupleKey {
	return &openfgav1.CheckRequestTupleKey{
		Object:   object,
		Relation: relation,
		User:     user,
	}
}

func NewExpandRequestTupleKey(object, relation string) *openfgav1.ExpandRequestTupleKey {
	return &openfgav1.ExpandRequestTupleKey{
		Object:   object,
		Relation: relation,
	}
}

// ObjectKey returns the canonical key for the provided Object. The ObjectKey of an object
// is the string 'objectType:objectId'.
func ObjectKey(obj *openfgav1.Object) string {
	return BuildObject(obj.GetType(), obj.GetId())
}

type UserString = string

// UserProtoToString returns a string from a User proto. Ex: 'user:maria' or 'group:fga#member'. It is
// the opposite of StringToUserProto function.
func UserProtoToString(obj *openfgav1.User) UserString {
	switch obj.GetUser().(type) {
	case *openfgav1.User_Wildcard:
		return obj.GetWildcard().GetType() + ":*"
	case *openfgav1.User_Userset:
		us := obj.GetUser().(*openfgav1.User_Userset)
		return us.Userset.GetType() + ":" + us.Userset.GetId() + "#" + us.Userset.GetRelation()
	case *openfgav1.User_Object:
		us := obj.GetUser().(*openfgav1.User_Object)
		return us.Object.GetType() + ":" + us.Object.GetId()
	default:
		panic("unsupported type")
	}
}

// StringToUserProto returns a User proto from a string. Ex: 'user:maria#member'.
// It is the opposite of UserProtoToString function.
func StringToUserProto(userKey UserString) *openfgav1.User {
	userObj, userRel := SplitObjectRelation(userKey)
	userObjType, userObjID := SplitObject(userObj)
	if userRel == "" && userObjID == "*" {
		return &openfgav1.User{User: &openfgav1.User_Wildcard{
			Wildcard: &openfgav1.TypedWildcard{
				Type: userObjType,
			},
		}}
	}
	if userRel == "" {
		return &openfgav1.User{User: &openfgav1.User_Object{Object: &openfgav1.Object{
			Type: userObjType,
			Id:   userObjID,
		}}}
	}
	return &openfgav1.User{User: &openfgav1.User_Userset{Userset: &openfgav1.UsersetUser{
		Type:     userObjType,
		Id:       userObjID,
		Relation: userRel,
	}}}
}

// SplitObject splits an object into an objectType, an optional objectRelation, and an objectID.
// E.g.
//  1. "group:fga" returns "group" and "fga".
//  2. "group#member:fga" returns "group#member" and "fga".
//  3. "anne" returns "" and "anne".
func SplitObject(object string) (string, string) {
	switch i := strings.IndexByte(object, ':'); i {
	case -1:
		return "", object
	case len(object) - 1:
		return object[0:i], ""
	default:
		return object[0:i], object[i+1:]
	}
}

func BuildObject(objectType, objectID string) string {
	return objectType + ":" + objectID
}

// GetObjectRelationAsString returns a string like "object#relation". If there is no relation it returns "object".
func GetObjectRelationAsString(objectRelation *openfgav1.ObjectRelation) string {
	if objectRelation.GetRelation() != "" {
		return objectRelation.GetObject() + "#" + objectRelation.GetRelation()
	}
	return objectRelation.GetObject()
}

// SplitObjectRelation splits an object relation string into an object ID and relation name. If no relation is present,
// it returns the original string and an empty relation.
func SplitObjectRelation(objectRelation string) (string, string) {
	switch i := strings.LastIndexByte(objectRelation, '#'); i {
	case -1:
		return objectRelation, ""
	case len(objectRelation) - 1:
		return objectRelation[0:i], ""
	default:
		return objectRelation[0:i], objectRelation[i+1:]
	}
}

// GetType returns the type from a supplied Object identifier or an empty string if the object id does not contain a
// type.
func GetType(objectID string) string {
	t, _ := SplitObject(objectID)
	return t
}

// GetRelation returns the 'relation' portion of an object relation string (e.g. `object#relation`), which may be empty if the input is malformed
// (or does not contain a relation).
func GetRelation(objectRelation string) string {
	_, relation := SplitObjectRelation(objectRelation)
	return relation
}

// IsObjectRelation returns true if the given string specifies a valid object and relation.
func IsObjectRelation(userset string) bool {
	return GetType(userset) != "" && GetRelation(userset) != ""
}

// ToObjectRelationString formats an object/relation pair as an object#relation string. This is the inverse of
// SplitObjectRelation.
func ToObjectRelationString(object, relation string) string {
	return object + "#" + relation
}

// GetUserTypeFromUser returns the type of user (userset or user).
func GetUserTypeFromUser(user string) UserType {
	if IsObjectRelation(user) || IsWildcard(user) {
		return UserSet
	}
	return User
}

// TupleKeyToString converts a tuple key into its string representation. It assumes the tupleKey is valid
// (i.e. no forbidden characters).
func TupleKeyToString(tk TupleWithoutCondition) string {
	return tk.GetObject() +
		"#" +
		tk.GetRelation() +
		"@" +
		tk.GetUser()
}

// TupleKeyWithConditionToString converts a tuple key with condition into its string representation. It assumes the tupleKey is valid
// (i.e. no forbidden characters).
func TupleKeyWithConditionToString(tk TupleWithCondition) string {
	var sb strings.Builder
	sb.WriteString(TupleKeyToString(tk))
	if tk.GetCondition() != nil {
		sb.WriteString(" (condition " + tk.GetCondition().GetName() + ")")
	}
	return sb.String()
}

// IsValidObject determines if a string s is a valid object. A valid object contains exactly one `:` and no `#` or spaces.
func IsValidObject(s string) bool {
	return objectRegex.MatchString(s)
}

// IsValidRelation determines if a string s is a valid relation. This means it does not contain any `:`, `#`, or spaces.
func IsValidRelation(s string) bool {
	return relationRegex.MatchString(s)
}

// IsValidUser determines if a string is a valid user. A valid user contains at most one `:`, at most one `#` and no spaces.
func IsValidUser(user string) bool {
	if user == Wildcard || userIDRegex.MatchString(user) || objectRegex.MatchString(user) || userSetRegex.MatchString(user) {
		return true
	}

	return false
}

// IsWildcard returns true if the string 's' could be interpreted as a typed or untyped wildcard (e.g. '*' or 'type:*').
func IsWildcard(s string) bool {
	return s == Wildcard || IsTypedWildcard(s)
}

// IsTypedWildcard returns true if the string 's' is a typed wildcard. A typed wildcard
// has the form 'type:*'.
func IsTypedWildcard(s string) bool {
	t, id := SplitObject(s)
	return t != "" && id == Wildcard
}

// TypedPublicWildcard returns the string tuple representation for a given object type (ex: "user:*").
func TypedPublicWildcard(objectType string) string {
	return BuildObject(objectType, Wildcard)
}

// MustParseTupleString attempts to parse a relationship tuple specified
// in string notation and return the protobuf TupleKey for it. If parsing
// of the string fails this  function will panic. It is meant for testing
// purposes.
//
// Given string 'document:1#viewer@user:jon', return the protobuf TupleKey
// for it.
func MustParseTupleString(s string) *openfgav1.TupleKey {
	t, err := ParseTupleString(s)
	if err != nil {
		panic(err)
	}

	return t
}

func MustParseTupleStrings(tupleStrs ...string) []*openfgav1.TupleKey {
	tuples := make([]*openfgav1.TupleKey, 0, len(tupleStrs))
	for _, tupleStr := range tupleStrs {
		tuples = append(tuples, MustParseTupleString(tupleStr))
	}

	return tuples
}

// ParseTupleString attempts to parse a relationship tuple specified
// in string notation and return the protobuf TupleKey for it. If parsing
// of the string fails this  function returns an err.
//
// Given string 'document:1#viewer@user:jon', return the protobuf TupleKey
// for it or an error.
func ParseTupleString(s string) (*openfgav1.TupleKey, error) {
	object, rhs, found := strings.Cut(s, "#")
	if !found {
		return nil, fmt.Errorf("expected at least one '#' separating the object and relation")
	}

	if !IsValidObject(object) {
		return nil, fmt.Errorf("invalid tuple 'object' field format")
	}

	relation, user, found := strings.Cut(rhs, "@")
	if !found {
		return nil, fmt.Errorf("expected at least one '@' separating the relation and user")
	}

	if !IsValidRelation(relation) {
		return nil, fmt.Errorf("invalid tuple 'relation' field format")
	}

	if !IsValidUser(user) {
		return nil, fmt.Errorf("invalid tuple 'user' field format")
	}

	return &openfgav1.TupleKey{
		Object:   object,
		Relation: relation,
		User:     user,
	}, nil
}

func ToUserPartsFromObjectRelation(u *openfgav1.ObjectRelation) (string, string, string) {
	userObjectType, userObjectID := SplitObject(u.GetObject())
	return userObjectType, userObjectID, u.GetRelation()
}

func ToUserParts(user string) (string, string, string) {
	userObject, userRelation := SplitObjectRelation(user) // e.g. (person:bob, "") or (group:abc, member) or (person:*, "")

	userObjectType, userObjectID := SplitObject(userObject)

	return userObjectType, userObjectID, userRelation
}

func FromUserParts(userObjectType, userObjectID, userRelation string) string {
	user := userObjectID
	if userObjectType != "" {
		user = userObjectType + ":" + userObjectID
	}
	if userRelation != "" {
		user = user + "#" + userRelation
	}
	return user
}

// IsSelfDefining returns true if the tuple is reflexive/self-defining. E.g. Document:1#viewer@document:1#viewer.
// See https://github.com/openfga/rfcs/blob/main/20240328-queries-with-usersets.md
func IsSelfDefining(tuple *openfgav1.TupleKey) bool {
	userObject, userRelation := SplitObjectRelation(tuple.GetUser())
	return tuple.GetRelation() == userRelation && tuple.GetObject() == userObject
}

// UsersetMatchTypeAndRelation returns true if the type and relation of a userset match the inputs.
func UsersetMatchTypeAndRelation(userset, relation, typee string) bool {
	userObjectType, _, userRelation := ToUserParts(userset)
	return relation == userRelation && typee == userObjectType
}
