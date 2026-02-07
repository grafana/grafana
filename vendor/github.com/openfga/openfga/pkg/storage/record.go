package storage

import (
	"time"

	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	tupleutils "github.com/openfga/openfga/pkg/tuple"
)

// TupleRecord represents a record structure used
// to store information about a specific tuple.
type TupleRecord struct {
	Store            string
	ObjectType       string
	ObjectID         string
	Relation         string
	User             string // Deprecated: Use UserObjectType, UserObjectID & UserRelation instead.
	UserObjectType   string
	UserObjectID     string
	UserRelation     string
	ConditionName    string
	ConditionContext *structpb.Struct
	Ulid             string
	InsertedAt       time.Time
}

// AsTuple converts a [TupleRecord] into a [*openfgav1.Tuple].
func (t *TupleRecord) AsTuple() *openfgav1.Tuple {
	user := t.User
	if t.User == "" {
		user = tupleutils.FromUserParts(t.UserObjectType, t.UserObjectID, t.UserRelation)
	}

	return &openfgav1.Tuple{
		Key: tupleutils.NewTupleKeyWithCondition(
			tupleutils.BuildObject(t.ObjectType, t.ObjectID),
			t.Relation,
			user,
			t.ConditionName,
			t.ConditionContext,
		),
		Timestamp: timestamppb.New(t.InsertedAt),
	}
}
