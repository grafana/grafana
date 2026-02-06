package messages

import (
	"fmt"
	"time"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/iana/asnAppTag"
	"github.com/jcmturner/gokrb5/v8/iana/msgtype"
	"github.com/jcmturner/gokrb5/v8/krberror"
	"github.com/jcmturner/gokrb5/v8/types"
)

// KRBSafe implements RFC 4120 KRB_SAFE: https://tools.ietf.org/html/rfc4120#section-5.6.1.
type KRBSafe struct {
	PVNO     int            `asn1:"explicit,tag:0"`
	MsgType  int            `asn1:"explicit,tag:1"`
	SafeBody KRBSafeBody    `asn1:"explicit,tag:2"`
	Cksum    types.Checksum `asn1:"explicit,tag:3"`
}

// KRBSafeBody implements the KRB_SAFE_BODY of KRB_SAFE.
type KRBSafeBody struct {
	UserData       []byte            `asn1:"explicit,tag:0"`
	Timestamp      time.Time         `asn1:"generalized,optional,explicit,tag:1"`
	Usec           int               `asn1:"optional,explicit,tag:2"`
	SequenceNumber int64             `asn1:"optional,explicit,tag:3"`
	SAddress       types.HostAddress `asn1:"explicit,tag:4"`
	RAddress       types.HostAddress `asn1:"optional,explicit,tag:5"`
}

// Unmarshal bytes b into the KRBSafe struct.
func (s *KRBSafe) Unmarshal(b []byte) error {
	_, err := asn1.UnmarshalWithParams(b, s, fmt.Sprintf("application,explicit,tag:%v", asnAppTag.KRBSafe))
	if err != nil {
		return processUnmarshalReplyError(b, err)
	}
	expectedMsgType := msgtype.KRB_SAFE
	if s.MsgType != expectedMsgType {
		return krberror.NewErrorf(krberror.KRBMsgError, "message ID does not indicate a KRB_SAFE. Expected: %v; Actual: %v", expectedMsgType, s.MsgType)
	}
	return nil
}
