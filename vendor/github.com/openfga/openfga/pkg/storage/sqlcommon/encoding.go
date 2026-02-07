package sqlcommon

import (
	"google.golang.org/protobuf/proto"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func MarshalRelationshipCondition(
	rel *openfgav1.RelationshipCondition,
) (name string, context []byte, err error) {
	if rel != nil {
		// Normalize empty context to nil.
		if rel.GetContext() != nil && len(rel.GetContext().GetFields()) > 0 {
			context, err = proto.Marshal(rel.GetContext())
			if err != nil {
				return name, context, err
			}
		}

		return rel.GetName(), context, err
	}

	return name, context, err
}
