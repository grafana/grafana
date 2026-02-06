// Package udecimal provides a high-performance, high-precision
// (up to 19 digits after the decimal point) decimal arithmetic library.
// It includes functions for parsing and performing arithmetic
// operations such as addition, subtraction, multiplication, and division
// on decimal numbers. The package is designed to handle decimal numbers
// with a high degree of precision and efficiency, making it suitable for
// high-traffic financial applications where both precision and performance are critical.
//
// Maximum and default precision is 19 digits after the decimal point. The default precision
// can be changed globally to any value between 1 and 19 to suit your use case and make sure
// that the precision is consistent across the entire application. See [SetDefaultPrecision] for more details.
//
// # Codec
//
// The udecimal package supports various encoding and decoding mechanisms to facilitate easy integration with
// different data storage and transmission systems.
//
//   - Marshal/UnmarshalJSON
//   - Marshal/UnmarshalBinary: gob, protobuf
//   - SQL: The Decimal type implements the sql.Scanner interface, enabling seamless integration with SQL databases.
//
// For more details, see the documentation for each method.
package udecimal
