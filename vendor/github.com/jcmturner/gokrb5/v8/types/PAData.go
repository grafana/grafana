package types

// Reference: https://www.ietf.org/rfc/rfc4120.txt
// Section: 5.2.7
import (
	"fmt"
	"time"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/iana/patype"
)

// PAData implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.2.7
type PAData struct {
	PADataType  int32  `asn1:"explicit,tag:1"`
	PADataValue []byte `asn1:"explicit,tag:2"`
}

// PADataSequence implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.2.7
type PADataSequence []PAData

// MethodData implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.9.1
type MethodData []PAData

// PAEncTimestamp implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.2.7.2
type PAEncTimestamp EncryptedData

// PAEncTSEnc implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.2.7.2
type PAEncTSEnc struct {
	PATimestamp time.Time `asn1:"generalized,explicit,tag:0"`
	PAUSec      int       `asn1:"explicit,optional,tag:1"`
}

// Contains tests if a PADataSequence contains PA Data of a certain type.
func (pas *PADataSequence) Contains(patype int32) bool {
	for _, pa := range *pas {
		if pa.PADataType == patype {
			return true
		}
	}
	return false
}

// GetPAEncTSEncAsnMarshalled returns the bytes of a PAEncTSEnc.
func GetPAEncTSEncAsnMarshalled() ([]byte, error) {
	t := time.Now().UTC()
	p := PAEncTSEnc{
		PATimestamp: t,
		PAUSec:      int((t.UnixNano() / int64(time.Microsecond)) - (t.Unix() * 1e6)),
	}
	b, err := asn1.Marshal(p)
	if err != nil {
		return b, fmt.Errorf("error mashaling PAEncTSEnc: %v", err)
	}
	return b, nil
}

// ETypeInfoEntry implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.2.7.4
type ETypeInfoEntry struct {
	EType int32  `asn1:"explicit,tag:0"`
	Salt  []byte `asn1:"explicit,optional,tag:1"`
}

// ETypeInfo implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.2.7.4
type ETypeInfo []ETypeInfoEntry

// ETypeInfo2Entry implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.2.7.5
type ETypeInfo2Entry struct {
	EType     int32  `asn1:"explicit,tag:0"`
	Salt      string `asn1:"explicit,optional,generalstring,tag:1"`
	S2KParams []byte `asn1:"explicit,optional,tag:2"`
}

// ETypeInfo2 implements RFC 4120 types: https://tools.ietf.org/html/rfc4120#section-5.2.7.5
type ETypeInfo2 []ETypeInfo2Entry

// PAReqEncPARep PA Data Type
type PAReqEncPARep struct {
	ChksumType int32  `asn1:"explicit,tag:0"`
	Chksum     []byte `asn1:"explicit,tag:1"`
}

// Unmarshal bytes into the PAData
func (pa *PAData) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, pa)
	return err
}

// Unmarshal bytes into the PADataSequence
func (pas *PADataSequence) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, pas)
	return err
}

// Unmarshal bytes into the PAReqEncPARep
func (pa *PAReqEncPARep) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, pa)
	return err
}

// Unmarshal bytes into the PAEncTimestamp
func (pa *PAEncTimestamp) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, pa)
	return err
}

// Unmarshal bytes into the PAEncTSEnc
func (pa *PAEncTSEnc) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, pa)
	return err
}

// Unmarshal bytes into the ETypeInfo
func (a *ETypeInfo) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, a)
	return err
}

// Unmarshal bytes into the ETypeInfoEntry
func (a *ETypeInfoEntry) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, a)
	return err
}

// Unmarshal bytes into the ETypeInfo2
func (a *ETypeInfo2) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, a)
	return err
}

// Unmarshal bytes into the ETypeInfo2Entry
func (a *ETypeInfo2Entry) Unmarshal(b []byte) error {
	_, err := asn1.Unmarshal(b, a)
	return err
}

// GetETypeInfo returns an ETypeInfo from the PAData.
func (pa *PAData) GetETypeInfo() (d ETypeInfo, err error) {
	if pa.PADataType != patype.PA_ETYPE_INFO {
		err = fmt.Errorf("PAData does not contain PA EType Info data. TypeID Expected: %v; Actual: %v", patype.PA_ETYPE_INFO, pa.PADataType)
		return
	}
	_, err = asn1.Unmarshal(pa.PADataValue, &d)
	return
}

// GetETypeInfo2 returns an ETypeInfo2 from the PAData.
func (pa *PAData) GetETypeInfo2() (d ETypeInfo2, err error) {
	if pa.PADataType != patype.PA_ETYPE_INFO2 {
		err = fmt.Errorf("PAData does not contain PA EType Info 2 data. TypeID Expected: %v; Actual: %v", patype.PA_ETYPE_INFO2, pa.PADataType)
		return
	}
	_, err = asn1.Unmarshal(pa.PADataValue, &d)
	return
}
