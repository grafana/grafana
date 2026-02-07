
//line pkg/logql/log/pattern/lexer.rl:1
package pattern


//line pkg/logql/log/pattern/lexer.rl.go:7
var _pattern_actions []byte = []byte{
	0, 1, 0, 1, 1, 1, 2, 1, 3, 
	1, 4, 1, 5, 1, 6, 
}

var _pattern_key_offsets []byte = []byte{
	0, 0, 8, 10, 12, 14, 16, 18, 
	20, 22, 37, 
}

var _pattern_trans_keys []byte = []byte{
	62, 95, 48, 57, 65, 90, 97, 122, 
	128, 191, 160, 191, 128, 191, 128, 159, 
	144, 191, 128, 191, 128, 143, 60, 224, 
	237, 240, 244, 128, 193, 194, 223, 225, 
	239, 241, 243, 245, 255, 95, 65, 90, 
	97, 122, 
}

var _pattern_single_lengths []byte = []byte{
	0, 2, 0, 0, 0, 0, 0, 0, 
	0, 5, 1, 
}

var _pattern_range_lengths []byte = []byte{
	0, 3, 1, 1, 1, 1, 1, 1, 
	1, 5, 2, 
}

var _pattern_index_offsets []byte = []byte{
	0, 0, 6, 8, 10, 12, 14, 16, 
	18, 20, 31, 
}

var _pattern_indicies []byte = []byte{
	2, 1, 1, 1, 1, 0, 3, 4, 
	5, 4, 5, 4, 5, 4, 6, 4, 
	6, 4, 6, 4, 7, 8, 9, 10, 
	12, 4, 5, 6, 11, 4, 3, 1, 
	1, 1, 13, 
}

var _pattern_trans_targs []byte = []byte{
	9, 1, 9, 9, 0, 2, 4, 10, 
	3, 5, 6, 7, 8, 9, 
}

var _pattern_trans_actions []byte = []byte{
	13, 0, 7, 9, 0, 0, 0, 5, 
	0, 0, 0, 0, 0, 11, 
}

var _pattern_to_state_actions []byte = []byte{
	0, 0, 0, 0, 0, 0, 0, 0, 
	0, 1, 0, 
}

var _pattern_from_state_actions []byte = []byte{
	0, 0, 0, 0, 0, 0, 0, 0, 
	0, 3, 0, 
}

var _pattern_eof_trans []byte = []byte{
	0, 1, 0, 0, 0, 0, 0, 0, 
	0, 0, 14, 
}

const pattern_start int = 9
const pattern_first_final int = 9
const pattern_error int = 0

const pattern_en_main int = 9


//line pkg/logql/log/pattern/lexer.rl:14



//line pkg/logql/log/pattern/lexer.rl:28


const LEXER_ERROR = 0


//line pkg/logql/log/pattern/lexer.rl:35


func (lex *lexer) Lex(out *exprSymType) int {
    eof := lex.pe
    tok := 0

    
//line pkg/logql/log/pattern/lexer.rl.go:100
	{
	var _klen int
	var _trans int
	var _acts int
	var _nacts uint
	var _keys int
	if ( lex.p) == ( lex.pe) {
		goto _test_eof
	}
	if  lex.cs == 0 {
		goto _out
	}
_resume:
	_acts = int(_pattern_from_state_actions[ lex.cs])
	_nacts = uint(_pattern_actions[_acts]); _acts++
	for ; _nacts > 0; _nacts-- {
		 _acts++
		switch _pattern_actions[_acts - 1] {
		case 1:
//line NONE:1
 lex.ts = ( lex.p)

//line pkg/logql/log/pattern/lexer.rl.go:123
		}
	}

	_keys = int(_pattern_key_offsets[ lex.cs])
	_trans = int(_pattern_index_offsets[ lex.cs])

	_klen = int(_pattern_single_lengths[ lex.cs])
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
			case  lex.data[( lex.p)] < _pattern_trans_keys[_mid]:
				_upper = _mid - 1
			case  lex.data[( lex.p)] > _pattern_trans_keys[_mid]:
				_lower = _mid + 1
			default:
				_trans += int(_mid - int(_keys))
				goto _match
			}
		}
		_keys += _klen
		_trans += _klen
	}

	_klen = int(_pattern_range_lengths[ lex.cs])
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
			case  lex.data[( lex.p)] < _pattern_trans_keys[_mid]:
				_upper = _mid - 2
			case  lex.data[( lex.p)] > _pattern_trans_keys[_mid + 1]:
				_lower = _mid + 2
			default:
				_trans += int((_mid - int(_keys)) >> 1)
				goto _match
			}
		}
		_trans += _klen
	}

_match:
	_trans = int(_pattern_indicies[_trans])
_eof_trans:
	 lex.cs = int(_pattern_trans_targs[_trans])

	if _pattern_trans_actions[_trans] == 0 {
		goto _again
	}

	_acts = int(_pattern_trans_actions[_trans])
	_nacts = uint(_pattern_actions[_acts]); _acts++
	for ; _nacts > 0; _nacts-- {
		_acts++
		switch _pattern_actions[_acts-1] {
		case 2:
//line NONE:1
 lex.te = ( lex.p)+1

		case 3:
//line pkg/logql/log/pattern/lexer.rl:44
 lex.te = ( lex.p)+1
{ tok = lex.handle(lex.identifier(out)); ( lex.p)++; goto _out
 }
		case 4:
//line pkg/logql/log/pattern/lexer.rl:45
 lex.te = ( lex.p)+1
{ tok = lex.handle(lex.literal(out)); ( lex.p)++; goto _out
 }
		case 5:
//line pkg/logql/log/pattern/lexer.rl:45
 lex.te = ( lex.p)
( lex.p)--
{ tok = lex.handle(lex.literal(out)); ( lex.p)++; goto _out
 }
		case 6:
//line pkg/logql/log/pattern/lexer.rl:45
( lex.p) = ( lex.te) - 1
{ tok = lex.handle(lex.literal(out)); ( lex.p)++; goto _out
 }
//line pkg/logql/log/pattern/lexer.rl.go:218
		}
	}

_again:
	_acts = int(_pattern_to_state_actions[ lex.cs])
	_nacts = uint(_pattern_actions[_acts]); _acts++
	for ; _nacts > 0; _nacts-- {
		_acts++
		switch _pattern_actions[_acts-1] {
		case 0:
//line NONE:1
 lex.ts = 0

//line pkg/logql/log/pattern/lexer.rl.go:232
		}
	}

	if  lex.cs == 0 {
		goto _out
	}
	( lex.p)++
	if ( lex.p) != ( lex.pe) {
		goto _resume
	}
	_test_eof: {}
	if ( lex.p) == eof {
		if _pattern_eof_trans[ lex.cs] > 0 {
			_trans = int(_pattern_eof_trans[ lex.cs] - 1)
			goto _eof_trans
		}
	}

	_out: {}
	}

//line pkg/logql/log/pattern/lexer.rl:49


    return tok;
}


func (lex *lexer) init() {
    
//line pkg/logql/log/pattern/lexer.rl.go:263
	{
	 lex.cs = pattern_start
	 lex.ts = 0
	 lex.te = 0
	 lex.act = 0
	}

//line pkg/logql/log/pattern/lexer.rl:57
}
