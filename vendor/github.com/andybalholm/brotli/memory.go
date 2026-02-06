package brotli

/* Copyright 2016 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/*
Dynamically grows array capacity to at least the requested size
T: data type
A: array
C: capacity
R: requested size
*/
func brotli_ensure_capacity_uint8_t(a *[]byte, c *uint, r uint) {
	if *c < r {
		var new_size uint = *c
		if new_size == 0 {
			new_size = r
		}

		for new_size < r {
			new_size *= 2
		}

		if cap(*a) < int(new_size) {
			var new_array []byte = make([]byte, new_size)
			if *c != 0 {
				copy(new_array, (*a)[:*c])
			}

			*a = new_array
		} else {
			*a = (*a)[:new_size]
		}

		*c = new_size
	}
}

func brotli_ensure_capacity_uint32_t(a *[]uint32, c *uint, r uint) {
	var new_array []uint32
	if *c < r {
		var new_size uint = *c
		if new_size == 0 {
			new_size = r
		}

		for new_size < r {
			new_size *= 2
		}

		if cap(*a) < int(new_size) {
			new_array = make([]uint32, new_size)
			if *c != 0 {
				copy(new_array, (*a)[:*c])
			}

			*a = new_array
		} else {
			*a = (*a)[:new_size]
		}
		*c = new_size
	}
}
