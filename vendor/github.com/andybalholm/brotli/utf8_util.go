package brotli

/* Copyright 2013 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Heuristics for deciding about the UTF8-ness of strings. */

const kMinUTF8Ratio float64 = 0.75

/* Returns 1 if at least min_fraction of the bytes between pos and
   pos + length in the (data, mask) ring-buffer is UTF8-encoded, otherwise
   returns 0. */
func parseAsUTF8(symbol *int, input []byte, size uint) uint {
	/* ASCII */
	if input[0]&0x80 == 0 {
		*symbol = int(input[0])
		if *symbol > 0 {
			return 1
		}
	}

	/* 2-byte UTF8 */
	if size > 1 && input[0]&0xE0 == 0xC0 && input[1]&0xC0 == 0x80 {
		*symbol = (int(input[0])&0x1F)<<6 | int(input[1])&0x3F
		if *symbol > 0x7F {
			return 2
		}
	}

	/* 3-byte UFT8 */
	if size > 2 && input[0]&0xF0 == 0xE0 && input[1]&0xC0 == 0x80 && input[2]&0xC0 == 0x80 {
		*symbol = (int(input[0])&0x0F)<<12 | (int(input[1])&0x3F)<<6 | int(input[2])&0x3F
		if *symbol > 0x7FF {
			return 3
		}
	}

	/* 4-byte UFT8 */
	if size > 3 && input[0]&0xF8 == 0xF0 && input[1]&0xC0 == 0x80 && input[2]&0xC0 == 0x80 && input[3]&0xC0 == 0x80 {
		*symbol = (int(input[0])&0x07)<<18 | (int(input[1])&0x3F)<<12 | (int(input[2])&0x3F)<<6 | int(input[3])&0x3F
		if *symbol > 0xFFFF && *symbol <= 0x10FFFF {
			return 4
		}
	}

	/* Not UTF8, emit a special symbol above the UTF8-code space */
	*symbol = 0x110000 | int(input[0])

	return 1
}

/* Returns 1 if at least min_fraction of the data is UTF8-encoded.*/
func isMostlyUTF8(data []byte, pos uint, mask uint, length uint, min_fraction float64) bool {
	var size_utf8 uint = 0
	var i uint = 0
	for i < length {
		var symbol int
		current_data := data[(pos+i)&mask:]
		var bytes_read uint = parseAsUTF8(&symbol, current_data, length-i)
		i += bytes_read
		if symbol < 0x110000 {
			size_utf8 += bytes_read
		}
	}

	return float64(size_utf8) > min_fraction*float64(length)
}
