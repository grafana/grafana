package storagewrappersutil

import (
	"strconv"
	"strings"

	"github.com/cespare/xxhash/v2"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
)

const (
	OperationRead                 = "Read"
	OperationReadStartingWithUser = "ReadStartingWithUser"
	OperationReadUsersetTuples    = "ReadUsersetTuples"
	OperationReadUserTuple        = "ReadUserTuple"
)

func ReadStartingWithUserKey(
	store string,
	filter storage.ReadStartingWithUserFilter,
) (string, error) {
	var b strings.Builder
	b.WriteString(
		storage.GetReadStartingWithUserCacheKeyPrefix(store, filter.ObjectType, filter.Relation),
	)

	// NOTE: There is no need to limit the length of this
	// since at most it will have 2 entries (user and wildcard if possible)
	for _, objectRel := range filter.UserFilter {
		subject := objectRel.GetObject()
		if objectRel.GetRelation() != "" {
			subject = tuple.ToObjectRelationString(objectRel.GetObject(), objectRel.GetRelation())
		}
		b.WriteString("/" + subject)
	}

	if filter.ObjectIDs != nil {
		hasher := xxhash.New()
		for _, oid := range filter.ObjectIDs.Values() {
			if _, err := hasher.WriteString(oid); err != nil {
				return "", err
			}
		}

		b.WriteString("/" + strconv.FormatUint(hasher.Sum64(), 10))
	}
	return b.String(), nil
}

func ReadUsersetTuplesKey(store string, filter storage.ReadUsersetTuplesFilter) string {
	var b strings.Builder
	b.WriteString(
		storage.GetReadUsersetTuplesCacheKeyPrefix(store, filter.Object, filter.Relation),
	)

	var rb strings.Builder
	var wb strings.Builder

	for _, userset := range filter.AllowedUserTypeRestrictions {
		if _, ok := userset.GetRelationOrWildcard().(*openfgav1.RelationReference_Relation); ok {
			rb.WriteString("/" + userset.GetType() + "#" + userset.GetRelation())
		}
		if _, ok := userset.GetRelationOrWildcard().(*openfgav1.RelationReference_Wildcard); ok {
			wb.WriteString("/" + userset.GetType() + ":*")
		}
	}

	// wildcard should have precedence
	if wb.Len() > 0 {
		b.WriteString(wb.String())
	}

	if rb.Len() > 0 {
		b.WriteString(rb.String())
	}
	return b.String()
}

func ReadKey(store string, tupleKey *openfgav1.TupleKey) string {
	var b strings.Builder
	b.WriteString(
		storage.GetReadCacheKey(store, tuple.TupleKeyToString(tupleKey)),
	)
	return b.String()
}
