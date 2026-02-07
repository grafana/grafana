package decimal128

import "errors"

// AppendBinary implements the [encoding.BinaryAppender] interface. It
// marshals the Decimal into IEEE 754 format.
func (d Decimal) AppendBinary(buf []byte) ([]byte, error) {
	buf = append(
		buf,
		byte(d.hi>>56),
		byte(d.hi>>48),
		byte(d.hi>>40),
		byte(d.hi>>32),
		byte(d.hi>>24),
		byte(d.hi>>16),
		byte(d.hi>>8),
		byte(d.hi),
		byte(d.lo>>56),
		byte(d.lo>>48),
		byte(d.lo>>40),
		byte(d.lo>>32),
		byte(d.lo>>24),
		byte(d.lo>>16),
		byte(d.lo>>8),
		byte(d.lo),
	)

	return buf, nil
}

// MarshalBinary implements the [encoding.BinaryMarshaler] interface. It
// marshals the Decimal into IEEE 754 format.
func (d Decimal) MarshalBinary() ([]byte, error) {
	return []byte{
		byte(d.hi >> 56),
		byte(d.hi >> 48),
		byte(d.hi >> 40),
		byte(d.hi >> 32),
		byte(d.hi >> 24),
		byte(d.hi >> 16),
		byte(d.hi >> 8),
		byte(d.hi),
		byte(d.lo >> 56),
		byte(d.lo >> 48),
		byte(d.lo >> 40),
		byte(d.lo >> 32),
		byte(d.lo >> 24),
		byte(d.lo >> 16),
		byte(d.lo >> 8),
		byte(d.lo),
	}, nil
}

// UnmarshalBinary implements the [encoding.BinaryUnmarshaler] interface. It
// unmarshals a Decimal in IEEE 754 format.
func (d *Decimal) UnmarshalBinary(data []byte) error {
	if len(data) != 16 {
		return errors.New("Decimal.UnmarshalBinary: invalid length")
	}

	lo := uint64(data[15])
	lo |= uint64(data[14]) << 8
	lo |= uint64(data[13]) << 16
	lo |= uint64(data[12]) << 24
	lo |= uint64(data[11]) << 32
	lo |= uint64(data[10]) << 40
	lo |= uint64(data[9]) << 48
	lo |= uint64(data[8]) << 56

	hi := uint64(data[7])
	hi |= uint64(data[6]) << 8
	hi |= uint64(data[5]) << 16
	hi |= uint64(data[4]) << 24
	hi |= uint64(data[3]) << 32
	hi |= uint64(data[2]) << 40
	hi |= uint64(data[1]) << 48
	hi |= uint64(data[0]) << 56

	*d = Decimal{lo, hi}

	return nil
}
