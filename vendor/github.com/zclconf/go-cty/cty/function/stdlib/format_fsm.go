// line 1 "format_fsm.rl"
// This file is generated from format_fsm.rl. DO NOT EDIT.

// line 5 "format_fsm.rl"

package stdlib

import (
	"bytes"
	"fmt"
	"unicode/utf8"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
)

// line 21 "format_fsm.go"
var _formatfsm_actions []byte = []byte{
	0, 1, 0, 1, 1, 1, 2, 1, 4,
	1, 5, 1, 6, 1, 7, 1, 8,
	1, 9, 1, 10, 1, 11, 1, 14,
	1, 16, 1, 17, 1, 18, 2, 3,
	4, 2, 12, 10, 2, 12, 16, 2,
	12, 18, 2, 13, 14, 2, 15, 10,
	2, 15, 18,
}

var _formatfsm_key_offsets []byte = []byte{
	0, 0, 14, 27, 34, 36, 39, 43,
	51,
}

var _formatfsm_trans_keys []byte = []byte{
	32, 35, 37, 43, 45, 46, 48, 91,
	49, 57, 65, 90, 97, 122, 32, 35,
	43, 45, 46, 48, 91, 49, 57, 65,
	90, 97, 122, 91, 48, 57, 65, 90,
	97, 122, 49, 57, 93, 48, 57, 65,
	90, 97, 122, 46, 91, 48, 57, 65,
	90, 97, 122, 37,
}

var _formatfsm_single_lengths []byte = []byte{
	0, 8, 7, 1, 0, 1, 0, 2,
	1,
}

var _formatfsm_range_lengths []byte = []byte{
	0, 3, 3, 3, 1, 1, 2, 3,
	0,
}

var _formatfsm_index_offsets []byte = []byte{
	0, 0, 12, 23, 28, 30, 33, 36,
	42,
}

var _formatfsm_indicies []byte = []byte{
	1, 2, 3, 4, 5, 6, 7, 10,
	8, 9, 9, 0, 1, 2, 4, 5,
	6, 7, 10, 8, 9, 9, 0, 13,
	11, 12, 12, 0, 14, 0, 15, 14,
	0, 9, 9, 0, 16, 19, 17, 18,
	18, 0, 20, 3,
}

var _formatfsm_trans_targs []byte = []byte{
	0, 2, 2, 8, 2, 2, 3, 2,
	7, 8, 4, 3, 8, 4, 5, 6,
	3, 7, 8, 4, 1,
}

var _formatfsm_trans_actions []byte = []byte{
	7, 17, 9, 3, 15, 13, 25, 11,
	43, 29, 19, 27, 49, 46, 21, 0,
	37, 23, 40, 34, 1,
}

var _formatfsm_eof_actions []byte = []byte{
	0, 31, 31, 31, 31, 31, 31, 31,
	5,
}

const formatfsm_start int = 8
const formatfsm_first_final int = 8
const formatfsm_error int = 0

const formatfsm_en_main int = 8

// line 20 "format_fsm.rl"

func formatFSM(format string, a []cty.Value) (string, error) {
	var buf bytes.Buffer
	data := format
	nextArg := 1 // arg numbers are 1-based
	var verb formatVerb
	highestArgIdx := 0 // zero means "none", since arg numbers are 1-based

	// line 159 "format_fsm.rl"

	// Ragel state
	p := 0          // "Pointer" into data
	pe := len(data) // End-of-data "pointer"
	cs := 0         // current state (will be initialized by ragel-generated code)
	ts := 0
	te := 0
	eof := pe

	// Keep Go compiler happy even if generated code doesn't use these
	_ = ts
	_ = te
	_ = eof

	// line 123 "format_fsm.go"
	{
		cs = formatfsm_start
	}

	// line 128 "format_fsm.go"
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
		_keys = int(_formatfsm_key_offsets[cs])
		_trans = int(_formatfsm_index_offsets[cs])

		_klen = int(_formatfsm_single_lengths[cs])
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
				case data[p] < _formatfsm_trans_keys[_mid]:
					_upper = _mid - 1
				case data[p] > _formatfsm_trans_keys[_mid]:
					_lower = _mid + 1
				default:
					_trans += int(_mid - int(_keys))
					goto _match
				}
			}
			_keys += _klen
			_trans += _klen
		}

		_klen = int(_formatfsm_range_lengths[cs])
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
				case data[p] < _formatfsm_trans_keys[_mid]:
					_upper = _mid - 2
				case data[p] > _formatfsm_trans_keys[_mid+1]:
					_lower = _mid + 2
				default:
					_trans += int((_mid - int(_keys)) >> 1)
					goto _match
				}
			}
			_trans += _klen
		}

	_match:
		_trans = int(_formatfsm_indicies[_trans])
		cs = int(_formatfsm_trans_targs[_trans])

		if _formatfsm_trans_actions[_trans] == 0 {
			goto _again
		}

		_acts = int(_formatfsm_trans_actions[_trans])
		_nacts = uint(_formatfsm_actions[_acts])
		_acts++
		for ; _nacts > 0; _nacts-- {
			_acts++
			switch _formatfsm_actions[_acts-1] {
			case 0:
				// line 31 "format_fsm.rl"

				verb = formatVerb{
					ArgNum: nextArg,
					Prec:   -1,
					Width:  -1,
				}
				ts = p

			case 1:
				// line 40 "format_fsm.rl"

				buf.WriteByte(data[p])

			case 4:
				// line 51 "format_fsm.rl"

				// We'll try to slurp a whole UTF-8 sequence here, to give the user
				// better feedback.
				r, _ := utf8.DecodeRuneInString(data[p:])
				return buf.String(), fmt.Errorf("unrecognized format character %q at offset %d", r, p)

			case 5:
				// line 58 "format_fsm.rl"

				verb.Sharp = true

			case 6:
				// line 61 "format_fsm.rl"

				verb.Zero = true

			case 7:
				// line 64 "format_fsm.rl"

				verb.Minus = true

			case 8:
				// line 67 "format_fsm.rl"

				verb.Plus = true

			case 9:
				// line 70 "format_fsm.rl"

				verb.Space = true

			case 10:
				// line 74 "format_fsm.rl"

				verb.ArgNum = 0

			case 11:
				// line 77 "format_fsm.rl"

				verb.ArgNum = (10 * verb.ArgNum) + (int(data[p]) - '0')

			case 12:
				// line 81 "format_fsm.rl"

				verb.HasWidth = true

			case 13:
				// line 84 "format_fsm.rl"

				verb.Width = 0

			case 14:
				// line 87 "format_fsm.rl"

				verb.Width = (10 * verb.Width) + (int(data[p]) - '0')

			case 15:
				// line 91 "format_fsm.rl"

				verb.HasPrec = true

			case 16:
				// line 94 "format_fsm.rl"

				verb.Prec = 0

			case 17:
				// line 97 "format_fsm.rl"

				verb.Prec = (10 * verb.Prec) + (int(data[p]) - '0')

			case 18:
				// line 101 "format_fsm.rl"

				verb.Mode = rune(data[p])
				te = p + 1
				verb.Raw = data[ts:te]
				verb.Offset = ts

				if verb.ArgNum > highestArgIdx {
					highestArgIdx = verb.ArgNum
				}

				err := formatAppend(&verb, &buf, a)
				if err != nil {
					return buf.String(), err
				}
				nextArg = verb.ArgNum + 1

				// line 330 "format_fsm.go"
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
			__acts := _formatfsm_eof_actions[cs]
			__nacts := uint(_formatfsm_actions[__acts])
			__acts++
			for ; __nacts > 0; __nacts-- {
				__acts++
				switch _formatfsm_actions[__acts-1] {
				case 2:
					// line 44 "format_fsm.rl"

				case 3:
					// line 47 "format_fsm.rl"

					return buf.String(), fmt.Errorf("invalid format string starting at offset %d", p)

				case 4:
					// line 51 "format_fsm.rl"

					// We'll try to slurp a whole UTF-8 sequence here, to give the user
					// better feedback.
					r, _ := utf8.DecodeRuneInString(data[p:])
					return buf.String(), fmt.Errorf("unrecognized format character %q at offset %d", r, p)

					// line 369 "format_fsm.go"
				}
			}
		}

	_out:
		{
		}
	}

	// line 177 "format_fsm.rl"

	// If we fall out here without being in a final state then we've
	// encountered something that the scanner can't match, which should
	// be impossible (the scanner matches all bytes _somehow_) but we'll
	// flag it anyway rather than just losing data from the end.
	if cs < formatfsm_first_final {
		return buf.String(), fmt.Errorf("extraneous characters beginning at offset %d", p)
	}

	if highestArgIdx < len(a) {
		// Extraneous args are an error, to more easily detect mistakes
		firstBad := highestArgIdx + 1
		if highestArgIdx == 0 {
			// Custom error message for this case
			return buf.String(), function.NewArgErrorf(firstBad, "too many arguments; no verbs in format string")
		}
		return buf.String(), function.NewArgErrorf(firstBad, "too many arguments; only %d used by format string", highestArgIdx)
	}

	return buf.String(), nil
}
