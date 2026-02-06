//line scan_string_lit.rl:1
// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

// This file is generated from scan_string_lit.rl. DO NOT EDIT.

//line scan_string_lit.go:11
var _hclstrtok_actions []byte = []byte{
	0, 1, 0, 1, 1, 2, 1, 0,
}

var _hclstrtok_key_offsets []byte = []byte{
	0, 0, 2, 4, 6, 10, 14, 18,
	22, 27, 31, 36, 41, 46, 51, 57,
	62, 74, 85, 96, 107, 118, 129, 140,
	151,
}

var _hclstrtok_trans_keys []byte = []byte{
	128, 191, 128, 191, 128, 191, 10, 13,
	36, 37, 10, 13, 36, 37, 10, 13,
	36, 37, 10, 13, 36, 37, 10, 13,
	36, 37, 123, 10, 13, 36, 37, 10,
	13, 36, 37, 92, 10, 13, 36, 37,
	92, 10, 13, 36, 37, 92, 10, 13,
	36, 37, 92, 10, 13, 36, 37, 92,
	123, 10, 13, 36, 37, 92, 85, 117,
	128, 191, 192, 223, 224, 239, 240, 247,
	248, 255, 10, 13, 36, 37, 92, 48,
	57, 65, 70, 97, 102, 10, 13, 36,
	37, 92, 48, 57, 65, 70, 97, 102,
	10, 13, 36, 37, 92, 48, 57, 65,
	70, 97, 102, 10, 13, 36, 37, 92,
	48, 57, 65, 70, 97, 102, 10, 13,
	36, 37, 92, 48, 57, 65, 70, 97,
	102, 10, 13, 36, 37, 92, 48, 57,
	65, 70, 97, 102, 10, 13, 36, 37,
	92, 48, 57, 65, 70, 97, 102, 10,
	13, 36, 37, 92, 48, 57, 65, 70,
	97, 102,
}

var _hclstrtok_single_lengths []byte = []byte{
	0, 0, 0, 0, 4, 4, 4, 4,
	5, 4, 5, 5, 5, 5, 6, 5,
	2, 5, 5, 5, 5, 5, 5, 5,
	5,
}

var _hclstrtok_range_lengths []byte = []byte{
	0, 1, 1, 1, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0,
	5, 3, 3, 3, 3, 3, 3, 3,
	3,
}

var _hclstrtok_index_offsets []byte = []byte{
	0, 0, 2, 4, 6, 11, 16, 21,
	26, 32, 37, 43, 49, 55, 61, 68,
	74, 82, 91, 100, 109, 118, 127, 136,
	145,
}

var _hclstrtok_indicies []byte = []byte{
	0, 1, 2, 1, 3, 1, 5, 6,
	7, 8, 4, 10, 11, 12, 13, 9,
	14, 11, 12, 13, 9, 10, 11, 15,
	13, 9, 10, 11, 12, 13, 14, 9,
	10, 11, 12, 15, 9, 17, 18, 19,
	20, 21, 16, 23, 24, 25, 26, 27,
	22, 0, 24, 25, 26, 27, 22, 23,
	24, 28, 26, 27, 22, 23, 24, 25,
	26, 27, 0, 22, 23, 24, 25, 28,
	27, 22, 29, 30, 22, 2, 3, 31,
	22, 0, 23, 24, 25, 26, 27, 32,
	32, 32, 22, 23, 24, 25, 26, 27,
	33, 33, 33, 22, 23, 24, 25, 26,
	27, 34, 34, 34, 22, 23, 24, 25,
	26, 27, 30, 30, 30, 22, 23, 24,
	25, 26, 27, 35, 35, 35, 22, 23,
	24, 25, 26, 27, 36, 36, 36, 22,
	23, 24, 25, 26, 27, 37, 37, 37,
	22, 23, 24, 25, 26, 27, 0, 0,
	0, 22,
}

var _hclstrtok_trans_targs []byte = []byte{
	11, 0, 1, 2, 4, 5, 6, 7,
	9, 4, 5, 6, 7, 9, 5, 8,
	10, 11, 12, 13, 15, 16, 10, 11,
	12, 13, 15, 16, 14, 17, 21, 3,
	18, 19, 20, 22, 23, 24,
}

var _hclstrtok_trans_actions []byte = []byte{
	0, 0, 0, 0, 0, 1, 1, 1,
	1, 3, 5, 5, 5, 5, 0, 0,
	0, 1, 1, 1, 1, 1, 3, 5,
	5, 5, 5, 5, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0,
}

var _hclstrtok_eof_actions []byte = []byte{
	0, 0, 0, 0, 0, 3, 3, 3,
	3, 3, 0, 3, 3, 3, 3, 3,
	3, 3, 3, 3, 3, 3, 3, 3,
	3,
}

const hclstrtok_start int = 4
const hclstrtok_first_final int = 4
const hclstrtok_error int = 0

const hclstrtok_en_quoted int = 10
const hclstrtok_en_unquoted int = 4

//line scan_string_lit.rl:12

func scanStringLit(data []byte, quoted bool) [][]byte {
	var ret [][]byte

//line scan_string_lit.rl:63

	// Ragel state
	p := 0          // "Pointer" into data
	pe := len(data) // End-of-data "pointer"
	ts := 0
	te := 0
	eof := pe

	var cs int // current state
	switch {
	case quoted:
		cs = hclstrtok_en_quoted
	default:
		cs = hclstrtok_en_unquoted
	}

	// Make Go compiler happy
	_ = ts
	_ = eof

	/*token := func () {
	    ret = append(ret, data[ts:te])
	}*/

//line scan_string_lit.go:156
	{
	}

//line scan_string_lit.go:160
	{
		var _klen int
		var _trans int
		var _acts int
		var _nacts uint
		var _keys int
		if p == pe {
			goto _test_eof
		}
		if cs == 0 {
			goto _out
		}
	_resume:
		_keys = int(_hclstrtok_key_offsets[cs])
		_trans = int(_hclstrtok_index_offsets[cs])

		_klen = int(_hclstrtok_single_lengths[cs])
		if _klen > 0 {
			_lower := int(_keys)
			var _mid int
			_upper := int(_keys + _klen - 1)
			for {
				if _upper < _lower {
					break
				}

				_mid = _lower + ((_upper - _lower) >> 1)
				switch {
				case data[p] < _hclstrtok_trans_keys[_mid]:
					_upper = _mid - 1
				case data[p] > _hclstrtok_trans_keys[_mid]:
					_lower = _mid + 1
				default:
					_trans += int(_mid - int(_keys))
					goto _match
				}
			}
			_keys += _klen
			_trans += _klen
		}

		_klen = int(_hclstrtok_range_lengths[cs])
		if _klen > 0 {
			_lower := int(_keys)
			var _mid int
			_upper := int(_keys + (_klen << 1) - 2)
			for {
				if _upper < _lower {
					break
				}

				_mid = _lower + (((_upper - _lower) >> 1) & ^1)
				switch {
				case data[p] < _hclstrtok_trans_keys[_mid]:
					_upper = _mid - 2
				case data[p] > _hclstrtok_trans_keys[_mid+1]:
					_lower = _mid + 2
				default:
					_trans += int((_mid - int(_keys)) >> 1)
					goto _match
				}
			}
			_trans += _klen
		}

	_match:
		_trans = int(_hclstrtok_indicies[_trans])
		cs = int(_hclstrtok_trans_targs[_trans])

		if _hclstrtok_trans_actions[_trans] == 0 {
			goto _again
		}

		_acts = int(_hclstrtok_trans_actions[_trans])
		_nacts = uint(_hclstrtok_actions[_acts])
		_acts++
		for ; _nacts > 0; _nacts-- {
			_acts++
			switch _hclstrtok_actions[_acts-1] {
			case 0:
//line scan_string_lit.rl:42

				// If te is behind p then we've skipped over some literal
				// characters which we must now return.
				if te < p {
					ret = append(ret, data[te:p])
				}
				ts = p

			case 1:
//line scan_string_lit.rl:50

				te = p
				ret = append(ret, data[ts:te])

//line scan_string_lit.go:255
			}
		}

	_again:
		if cs == 0 {
			goto _out
		}
		p++
		if p != pe {
			goto _resume
		}
	_test_eof:
		{
		}
		if p == eof {
			__acts := _hclstrtok_eof_actions[cs]
			__nacts := uint(_hclstrtok_actions[__acts])
			__acts++
			for ; __nacts > 0; __nacts-- {
				__acts++
				switch _hclstrtok_actions[__acts-1] {
				case 1:
//line scan_string_lit.rl:50

					te = p
					ret = append(ret, data[ts:te])

//line scan_string_lit.go:280
				}
			}
		}

	_out:
		{
		}
	}

//line scan_string_lit.rl:91

	if te < p {
		// Collect any leftover literal characters at the end of the input
		ret = append(ret, data[te:p])
	}

	// If we fall out here without being in a final state then we've
	// encountered something that the scanner can't match, which should
	// be impossible (the scanner matches all bytes _somehow_) but we'll
	// tolerate it and let the caller deal with it.
	if cs < hclstrtok_first_final {
		ret = append(ret, data[p:len(data)])
	}

	return ret
}
