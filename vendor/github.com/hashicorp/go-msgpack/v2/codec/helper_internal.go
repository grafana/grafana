// Copyright (c) 2012-2015 Ugorji Nwoke. All rights reserved.
// Use of this source code is governed by a MIT license found in the LICENSE file.

package codec

// All non-std package dependencies live in this file,
// so porting to different environment is easy (just update functions).

func pruneSignExt(v []byte, pos bool) (n int) {
	if len(v) < 2 {
	} else if pos && v[0] == 0 {
		for ; v[n] == 0 && n+1 < len(v) && (v[n+1]&(1<<7) == 0); n++ {
		}
	} else if !pos && v[0] == 0xff {
		for ; v[n] == 0xff && n+1 < len(v) && (v[n+1]&(1<<7) != 0); n++ {
		}
	}
	return
}

// GrowCap will return a new capacity for a slice, given the following:
//   - oldCap: current capacity
//   - unit: in-memory size of an element
//   - num: number of elements to add
func growCap(oldCap, unit, num int) (newCap int) {
	// appendslice logic (if cap < 1024, *2, else *1.25):
	//   leads to many copy calls, especially when copying bytes.
	//   bytes.Buffer model (2*cap + n): much better for bytes.
	// smarter way is to take the byte-size of the appended element(type) into account

	// maintain 3 thresholds:
	// t1: if cap <= t1, newcap = 2x
	// t2: if cap <= t2, newcap = 1.75x
	// t3: if cap <= t3, newcap = 1.5x
	//     else          newcap = 1.25x
	//
	// t1, t2, t3 >= 1024 always.
	// i.e. if unit size >= 16, then always do 2x or 1.25x (ie t1, t2, t3 are all same)
	//
	// With this, appending for bytes increase by:
	//    100% up to 4K
	//     75% up to 8K
	//     50% up to 16K
	//     25% beyond that

	// unit can be 0 e.g. for struct{}{}; handle that appropriately
	var t1, t2, t3 int // thresholds
	if unit <= 1 {
		t1, t2, t3 = 4*1024, 8*1024, 16*1024
	} else if unit < 16 {
		t3 = 16 / unit * 1024
		t1 = t3 * 1 / 4
		t2 = t3 * 2 / 4
	} else {
		t1, t2, t3 = 1024, 1024, 1024
	}

	var x int // temporary variable

	// x is multiplier here: one of 5, 6, 7 or 8; incr of 25%, 50%, 75% or 100% respectively
	if oldCap <= t1 { // [0,t1]
		x = 8
	} else if oldCap > t3 { // (t3,infinity]
		x = 5
	} else if oldCap <= t2 { // (t1,t2]
		x = 7
	} else { // (t2,t3]
		x = 6
	}
	newCap = x * oldCap / 4

	if num > 0 {
		newCap += num
	}

	// ensure newCap is a multiple of 64 (if it is > 64) or 16.
	if newCap > 64 {
		if x = newCap % 64; x != 0 {
			x = newCap / 64
			newCap = 64 * (x + 1)
		}
	} else {
		if x = newCap % 16; x != 0 {
			x = newCap / 16
			newCap = 16 * (x + 1)
		}
	}
	return
}
