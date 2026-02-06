package pgtype

import (
	"bytes"
	"database/sql/driver"
	"errors"
	"fmt"
	"net/netip"
)

// Network address family is dependent on server socket.h value for AF_INET.
// In practice, all platforms appear to have the same value. See
// src/include/utils/inet.h for more information.
const (
	defaultAFInet  = 2
	defaultAFInet6 = 3
)

type NetipPrefixScanner interface {
	ScanNetipPrefix(v netip.Prefix) error
}

type NetipPrefixValuer interface {
	NetipPrefixValue() (netip.Prefix, error)
}

// InetCodec handles both inet and cidr PostgreSQL types. The preferred Go types are [netip.Prefix] and [netip.Addr]. If
// IsValid() is false then they are treated as SQL NULL.
type InetCodec struct{}

func (InetCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (InetCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (InetCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(NetipPrefixValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanInetCodecBinary{}
	case TextFormatCode:
		return encodePlanInetCodecText{}
	}

	return nil
}

type encodePlanInetCodecBinary struct{}

func (encodePlanInetCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	prefix, err := value.(NetipPrefixValuer).NetipPrefixValue()
	if err != nil {
		return nil, err
	}

	if !prefix.IsValid() {
		return nil, nil
	}

	var family byte
	if prefix.Addr().Is4() {
		family = defaultAFInet
	} else {
		family = defaultAFInet6
	}

	buf = append(buf, family)

	ones := prefix.Bits()
	buf = append(buf, byte(ones))

	// is_cidr is ignored on server
	buf = append(buf, 0)

	if family == defaultAFInet {
		buf = append(buf, byte(4))
		b := prefix.Addr().As4()
		buf = append(buf, b[:]...)
	} else {
		buf = append(buf, byte(16))
		b := prefix.Addr().As16()
		buf = append(buf, b[:]...)
	}

	return buf, nil
}

type encodePlanInetCodecText struct{}

func (encodePlanInetCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	prefix, err := value.(NetipPrefixValuer).NetipPrefixValue()
	if err != nil {
		return nil, err
	}

	if !prefix.IsValid() {
		return nil, nil
	}

	return append(buf, prefix.String()...), nil
}

func (InetCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case NetipPrefixScanner:
			return scanPlanBinaryInetToNetipPrefixScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case NetipPrefixScanner:
			return scanPlanTextAnyToNetipPrefixScanner{}
		}
	}

	return nil
}

func (c InetCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c InetCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var prefix netip.Prefix
	err := codecScan(c, m, oid, format, src, (*netipPrefixWrapper)(&prefix))
	if err != nil {
		return nil, err
	}

	if !prefix.IsValid() {
		return nil, nil
	}

	return prefix, nil
}

type scanPlanBinaryInetToNetipPrefixScanner struct{}

func (scanPlanBinaryInetToNetipPrefixScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(NetipPrefixScanner)

	if src == nil {
		return scanner.ScanNetipPrefix(netip.Prefix{})
	}

	if len(src) != 8 && len(src) != 20 {
		return fmt.Errorf("Received an invalid size for an inet: %d", len(src))
	}

	// ignore family
	bits := src[1]
	// ignore is_cidr
	// ignore addressLength - implicit in length of message

	addr, ok := netip.AddrFromSlice(src[4:])
	if !ok {
		return errors.New("netip.AddrFromSlice failed")
	}

	return scanner.ScanNetipPrefix(netip.PrefixFrom(addr, int(bits)))
}

type scanPlanTextAnyToNetipPrefixScanner struct{}

func (scanPlanTextAnyToNetipPrefixScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(NetipPrefixScanner)

	if src == nil {
		return scanner.ScanNetipPrefix(netip.Prefix{})
	}

	var prefix netip.Prefix
	if bytes.IndexByte(src, '/') == -1 {
		addr, err := netip.ParseAddr(string(src))
		if err != nil {
			return err
		}
		prefix = netip.PrefixFrom(addr, addr.BitLen())
	} else {
		var err error
		prefix, err = netip.ParsePrefix(string(src))
		if err != nil {
			return err
		}
	}

	return scanner.ScanNetipPrefix(prefix)
}
