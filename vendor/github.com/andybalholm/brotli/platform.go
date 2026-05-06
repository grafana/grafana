package brotli

/* Copyright 2013 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

func brotli_min_double(a float64, b float64) float64 {
	if a < b {
		return a
	} else {
		return b
	}
}

func brotli_max_double(a float64, b float64) float64 {
	if a > b {
		return a
	} else {
		return b
	}
}

func brotli_min_float(a float32, b float32) float32 {
	if a < b {
		return a
	} else {
		return b
	}
}

func brotli_max_float(a float32, b float32) float32 {
	if a > b {
		return a
	} else {
		return b
	}
}

func brotli_min_int(a int, b int) int {
	if a < b {
		return a
	} else {
		return b
	}
}

func brotli_max_int(a int, b int) int {
	if a > b {
		return a
	} else {
		return b
	}
}

func brotli_min_size_t(a uint, b uint) uint {
	if a < b {
		return a
	} else {
		return b
	}
}

func brotli_max_size_t(a uint, b uint) uint {
	if a > b {
		return a
	} else {
		return b
	}
}

func brotli_min_uint32_t(a uint32, b uint32) uint32 {
	if a < b {
		return a
	} else {
		return b
	}
}

func brotli_max_uint32_t(a uint32, b uint32) uint32 {
	if a > b {
		return a
	} else {
		return b
	}
}

func brotli_min_uint8_t(a byte, b byte) byte {
	if a < b {
		return a
	} else {
		return b
	}
}

func brotli_max_uint8_t(a byte, b byte) byte {
	if a > b {
		return a
	} else {
		return b
	}
}
