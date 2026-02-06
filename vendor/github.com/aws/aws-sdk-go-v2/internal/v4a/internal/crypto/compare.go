package crypto

import "fmt"

// ConstantTimeByteCompare is a constant-time byte comparison of x and y. This function performs an absolute comparison
// if the two byte slices assuming they represent a big-endian number.
//
//		 error if len(x) != len(y)
//	  -1 if x <  y
//	   0 if x == y
//	  +1 if x >  y
func ConstantTimeByteCompare(x, y []byte) (int, error) {
	if len(x) != len(y) {
		return 0, fmt.Errorf("slice lengths do not match")
	}

	xLarger, yLarger := 0, 0

	for i := 0; i < len(x); i++ {
		xByte, yByte := int(x[i]), int(y[i])

		x := ((yByte - xByte) >> 8) & 1
		y := ((xByte - yByte) >> 8) & 1

		xLarger |= x &^ yLarger
		yLarger |= y &^ xLarger
	}

	return xLarger - yLarger, nil
}
