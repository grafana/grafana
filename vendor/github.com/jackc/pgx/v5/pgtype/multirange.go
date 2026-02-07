package pgtype

import (
	"bytes"
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"reflect"

	"github.com/jackc/pgx/v5/internal/pgio"
)

// MultirangeGetter is a type that can be converted into a PostgreSQL multirange.
type MultirangeGetter interface {
	// IsNull returns true if the value is SQL NULL.
	IsNull() bool

	// Len returns the number of elements in the multirange.
	Len() int

	// Index returns the element at i.
	Index(i int) any

	// IndexType returns a non-nil scan target of the type Index will return. This is used by MultirangeCodec.PlanEncode.
	IndexType() any
}

// MultirangeSetter is a type can be set from a PostgreSQL multirange.
type MultirangeSetter interface {
	// ScanNull sets the value to SQL NULL.
	ScanNull() error

	// SetLen prepares the value such that ScanIndex can be called for each element. This will remove any existing
	// elements.
	SetLen(n int) error

	// ScanIndex returns a value usable as a scan target for i. SetLen must be called before ScanIndex.
	ScanIndex(i int) any

	// ScanIndexType returns a non-nil scan target of the type ScanIndex will return. This is used by
	// MultirangeCodec.PlanScan.
	ScanIndexType() any
}

// MultirangeCodec is a codec for any multirange type.
type MultirangeCodec struct {
	ElementType *Type
}

func (c *MultirangeCodec) FormatSupported(format int16) bool {
	return c.ElementType.Codec.FormatSupported(format)
}

func (c *MultirangeCodec) PreferredFormat() int16 {
	return c.ElementType.Codec.PreferredFormat()
}

func (c *MultirangeCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	multirangeValuer, ok := value.(MultirangeGetter)
	if !ok {
		return nil
	}

	elementType := multirangeValuer.IndexType()

	elementEncodePlan := m.PlanEncode(c.ElementType.OID, format, elementType)
	if elementEncodePlan == nil {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return &encodePlanMultirangeCodecBinary{ac: c, m: m, oid: oid}
	case TextFormatCode:
		return &encodePlanMultirangeCodecText{ac: c, m: m, oid: oid}
	}

	return nil
}

type encodePlanMultirangeCodecText struct {
	ac  *MultirangeCodec
	m   *Map
	oid uint32
}

func (p *encodePlanMultirangeCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	multirange := value.(MultirangeGetter)

	if multirange.IsNull() {
		return nil, nil
	}

	elementCount := multirange.Len()

	buf = append(buf, '{')

	var encodePlan EncodePlan
	var lastElemType reflect.Type
	inElemBuf := make([]byte, 0, 32)
	for i := 0; i < elementCount; i++ {
		if i > 0 {
			buf = append(buf, ',')
		}

		elem := multirange.Index(i)
		var elemBuf []byte
		if elem != nil {
			elemType := reflect.TypeOf(elem)
			if lastElemType != elemType {
				lastElemType = elemType
				encodePlan = p.m.PlanEncode(p.ac.ElementType.OID, TextFormatCode, elem)
				if encodePlan == nil {
					return nil, fmt.Errorf("unable to encode %v", multirange.Index(i))
				}
			}
			elemBuf, err = encodePlan.Encode(elem, inElemBuf)
			if err != nil {
				return nil, err
			}
		}

		if elemBuf == nil {
			return nil, fmt.Errorf("multirange cannot contain NULL element")
		} else {
			buf = append(buf, elemBuf...)
		}
	}

	buf = append(buf, '}')

	return buf, nil
}

type encodePlanMultirangeCodecBinary struct {
	ac  *MultirangeCodec
	m   *Map
	oid uint32
}

func (p *encodePlanMultirangeCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	multirange := value.(MultirangeGetter)

	if multirange.IsNull() {
		return nil, nil
	}

	elementCount := multirange.Len()

	buf = pgio.AppendInt32(buf, int32(elementCount))

	var encodePlan EncodePlan
	var lastElemType reflect.Type
	for i := 0; i < elementCount; i++ {
		sp := len(buf)
		buf = pgio.AppendInt32(buf, -1)

		elem := multirange.Index(i)
		var elemBuf []byte
		if elem != nil {
			elemType := reflect.TypeOf(elem)
			if lastElemType != elemType {
				lastElemType = elemType
				encodePlan = p.m.PlanEncode(p.ac.ElementType.OID, BinaryFormatCode, elem)
				if encodePlan == nil {
					return nil, fmt.Errorf("unable to encode %v", multirange.Index(i))
				}
			}
			elemBuf, err = encodePlan.Encode(elem, buf)
			if err != nil {
				return nil, err
			}
		}

		if elemBuf == nil {
			return nil, fmt.Errorf("multirange cannot contain NULL element")
		} else {
			buf = elemBuf
			pgio.SetInt32(buf[sp:], int32(len(buf[sp:])-4))
		}
	}

	return buf, nil
}

func (c *MultirangeCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	multirangeScanner, ok := target.(MultirangeSetter)
	if !ok {
		return nil
	}

	elementType := multirangeScanner.ScanIndexType()

	elementScanPlan := m.PlanScan(c.ElementType.OID, format, elementType)
	if _, ok := elementScanPlan.(*scanPlanFail); ok {
		return nil
	}

	return &scanPlanMultirangeCodec{
		multirangeCodec: c,
		m:               m,
		oid:             oid,
		formatCode:      format,
	}
}

func (c *MultirangeCodec) decodeBinary(m *Map, multirangeOID uint32, src []byte, multirange MultirangeSetter) error {
	rp := 0

	elementCount := int(binary.BigEndian.Uint32(src[rp:]))
	rp += 4

	err := multirange.SetLen(elementCount)
	if err != nil {
		return err
	}

	if elementCount == 0 {
		return nil
	}

	elementScanPlan := c.ElementType.Codec.PlanScan(m, c.ElementType.OID, BinaryFormatCode, multirange.ScanIndex(0))
	if elementScanPlan == nil {
		elementScanPlan = m.PlanScan(c.ElementType.OID, BinaryFormatCode, multirange.ScanIndex(0))
	}

	for i := 0; i < elementCount; i++ {
		elem := multirange.ScanIndex(i)
		elemLen := int(int32(binary.BigEndian.Uint32(src[rp:])))
		rp += 4
		var elemSrc []byte
		if elemLen >= 0 {
			elemSrc = src[rp : rp+elemLen]
			rp += elemLen
		}
		err = elementScanPlan.Scan(elemSrc, elem)
		if err != nil {
			return fmt.Errorf("failed to scan multirange element %d: %w", i, err)
		}
	}

	return nil
}

func (c *MultirangeCodec) decodeText(m *Map, multirangeOID uint32, src []byte, multirange MultirangeSetter) error {
	elements, err := parseUntypedTextMultirange(src)
	if err != nil {
		return err
	}

	err = multirange.SetLen(len(elements))
	if err != nil {
		return err
	}

	if len(elements) == 0 {
		return nil
	}

	elementScanPlan := c.ElementType.Codec.PlanScan(m, c.ElementType.OID, TextFormatCode, multirange.ScanIndex(0))
	if elementScanPlan == nil {
		elementScanPlan = m.PlanScan(c.ElementType.OID, TextFormatCode, multirange.ScanIndex(0))
	}

	for i, s := range elements {
		elem := multirange.ScanIndex(i)
		err = elementScanPlan.Scan([]byte(s), elem)
		if err != nil {
			return err
		}
	}

	return nil
}

type scanPlanMultirangeCodec struct {
	multirangeCodec *MultirangeCodec
	m               *Map
	oid             uint32
	formatCode      int16
	elementScanPlan ScanPlan
}

func (spac *scanPlanMultirangeCodec) Scan(src []byte, dst any) error {
	c := spac.multirangeCodec
	m := spac.m
	oid := spac.oid
	formatCode := spac.formatCode

	multirange := dst.(MultirangeSetter)

	if src == nil {
		return multirange.ScanNull()
	}

	switch formatCode {
	case BinaryFormatCode:
		return c.decodeBinary(m, oid, src, multirange)
	case TextFormatCode:
		return c.decodeText(m, oid, src, multirange)
	default:
		return fmt.Errorf("unknown format code %d", formatCode)
	}
}

func (c *MultirangeCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	switch format {
	case TextFormatCode:
		return string(src), nil
	case BinaryFormatCode:
		buf := make([]byte, len(src))
		copy(buf, src)
		return buf, nil
	default:
		return nil, fmt.Errorf("unknown format code %d", format)
	}
}

func (c *MultirangeCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var multirange Multirange[Range[any]]
	err := m.PlanScan(oid, format, &multirange).Scan(src, &multirange)
	return multirange, err
}

func parseUntypedTextMultirange(src []byte) ([]string, error) {
	elements := make([]string, 0)

	buf := bytes.NewBuffer(src)

	skipWhitespace(buf)

	r, _, err := buf.ReadRune()
	if err != nil {
		return nil, fmt.Errorf("invalid array: %w", err)
	}

	if r != '{' {
		return nil, fmt.Errorf("invalid multirange, expected '{' got %v", r)
	}

parseValueLoop:
	for {
		r, _, err = buf.ReadRune()
		if err != nil {
			return nil, fmt.Errorf("invalid multirange: %w", err)
		}

		switch r {
		case ',': // skip range separator
		case '}':
			break parseValueLoop
		default:
			buf.UnreadRune()
			value, err := parseRange(buf)
			if err != nil {
				return nil, fmt.Errorf("invalid multirange value: %w", err)
			}
			elements = append(elements, value)
		}
	}

	skipWhitespace(buf)

	if buf.Len() > 0 {
		return nil, fmt.Errorf("unexpected trailing data: %v", buf.String())
	}

	return elements, nil
}

func parseRange(buf *bytes.Buffer) (string, error) {
	s := &bytes.Buffer{}

	boundSepRead := false
	for {
		r, _, err := buf.ReadRune()
		if err != nil {
			return "", err
		}

		switch r {
		case ',', '}':
			if r == ',' && !boundSepRead {
				boundSepRead = true
				break
			}
			buf.UnreadRune()
			return s.String(), nil
		}

		s.WriteRune(r)
	}
}

// Multirange is a generic multirange type.
//
// T should implement [RangeValuer] and *T should implement [RangeScanner]. However, there does not appear to be a way to
// enforce the [RangeScanner] constraint.
type Multirange[T RangeValuer] []T

func (r Multirange[T]) IsNull() bool {
	return r == nil
}

func (r Multirange[T]) Len() int {
	return len(r)
}

func (r Multirange[T]) Index(i int) any {
	return r[i]
}

func (r Multirange[T]) IndexType() any {
	var zero T
	return zero
}

func (r *Multirange[T]) ScanNull() error {
	*r = nil
	return nil
}

func (r *Multirange[T]) SetLen(n int) error {
	*r = make([]T, n)
	return nil
}

func (r Multirange[T]) ScanIndex(i int) any {
	return &r[i]
}

func (r Multirange[T]) ScanIndexType() any {
	return new(T)
}
