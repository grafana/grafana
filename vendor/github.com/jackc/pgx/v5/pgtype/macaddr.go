package pgtype

import (
	"database/sql/driver"
	"net"
)

type MacaddrCodec struct{}

func (MacaddrCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (MacaddrCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (MacaddrCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		switch value.(type) {
		case net.HardwareAddr:
			return encodePlanMacaddrCodecBinaryHardwareAddr{}
		case TextValuer:
			return encodePlanMacAddrCodecTextValuer{}

		}
	case TextFormatCode:
		switch value.(type) {
		case net.HardwareAddr:
			return encodePlanMacaddrCodecTextHardwareAddr{}
		case TextValuer:
			return encodePlanTextCodecTextValuer{}
		}
	}

	return nil
}

type encodePlanMacaddrCodecBinaryHardwareAddr struct{}

func (encodePlanMacaddrCodecBinaryHardwareAddr) Encode(value any, buf []byte) (newBuf []byte, err error) {
	addr := value.(net.HardwareAddr)
	if addr == nil {
		return nil, nil
	}

	return append(buf, addr...), nil
}

type encodePlanMacAddrCodecTextValuer struct{}

func (encodePlanMacAddrCodecTextValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	t, err := value.(TextValuer).TextValue()
	if err != nil {
		return nil, err
	}
	if !t.Valid {
		return nil, nil
	}

	addr, err := net.ParseMAC(t.String)
	if err != nil {
		return nil, err
	}

	return append(buf, addr...), nil
}

type encodePlanMacaddrCodecTextHardwareAddr struct{}

func (encodePlanMacaddrCodecTextHardwareAddr) Encode(value any, buf []byte) (newBuf []byte, err error) {
	addr := value.(net.HardwareAddr)
	if addr == nil {
		return nil, nil
	}

	return append(buf, addr.String()...), nil
}

func (MacaddrCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case *net.HardwareAddr:
			return scanPlanBinaryMacaddrToHardwareAddr{}
		case TextScanner:
			return scanPlanBinaryMacaddrToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case *net.HardwareAddr:
			return scanPlanTextMacaddrToHardwareAddr{}
		case TextScanner:
			return scanPlanTextAnyToTextScanner{}
		}
	}

	return nil
}

type scanPlanBinaryMacaddrToHardwareAddr struct{}

func (scanPlanBinaryMacaddrToHardwareAddr) Scan(src []byte, dst any) error {
	dstBuf := dst.(*net.HardwareAddr)
	if src == nil {
		*dstBuf = nil
		return nil
	}

	*dstBuf = make([]byte, len(src))
	copy(*dstBuf, src)
	return nil
}

type scanPlanBinaryMacaddrToTextScanner struct{}

func (scanPlanBinaryMacaddrToTextScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TextScanner)
	if src == nil {
		return scanner.ScanText(Text{})
	}

	return scanner.ScanText(Text{String: net.HardwareAddr(src).String(), Valid: true})
}

type scanPlanTextMacaddrToHardwareAddr struct{}

func (scanPlanTextMacaddrToHardwareAddr) Scan(src []byte, dst any) error {
	p := dst.(*net.HardwareAddr)

	if src == nil {
		*p = nil
		return nil
	}

	addr, err := net.ParseMAC(string(src))
	if err != nil {
		return err
	}

	*p = addr

	return nil
}

func (c MacaddrCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c MacaddrCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var addr net.HardwareAddr
	err := codecScan(c, m, oid, format, src, &addr)
	if err != nil {
		return nil, err
	}
	return addr, nil
}
