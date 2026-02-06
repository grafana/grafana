// This file is generated from format_fsm.rl. DO NOT EDIT.
%%{
	# (except you are actually in scan_tokens.rl here, so edit away!)
	machine formatfsm;
}%%

package stdlib

import (
	"bytes"
	"fmt"
	"unicode/utf8"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
)

%%{
	write data;
}%%

func formatFSM(format string, a []cty.Value) (string, error) {
	var buf bytes.Buffer
	data := format
	nextArg := 1 // arg numbers are 1-based
	var verb formatVerb
	highestArgIdx := 0 // zero means "none", since arg numbers are 1-based

	%%{

	action begin {
		verb = formatVerb{
			ArgNum: nextArg,
			Prec:   -1,
			Width:  -1,
		}
		ts = p
	}

	action emit {
		buf.WriteByte(fc);
	}

	action finish_ok {
	}

	action finish_err {
		return buf.String(), fmt.Errorf("invalid format string starting at offset %d", p)
	}

	action err_char {
		// We'll try to slurp a whole UTF-8 sequence here, to give the user
		// better feedback.
		r, _ := utf8.DecodeRuneInString(data[p:])
		return buf.String(), fmt.Errorf("unrecognized format character %q at offset %d", r, p)
	}

	action flag_sharp {
		verb.Sharp = true
	}
	action flag_zero {
		verb.Zero = true
	}
	action flag_minus {
		verb.Minus = true
	}
	action flag_plus {
		verb.Plus = true
	}
	action flag_space {
		verb.Space = true
	}

	action argidx_reset {
		verb.ArgNum = 0
	}
	action argidx_num {
		verb.ArgNum = (10 * verb.ArgNum) + (int(fc) - '0')
	}

	action has_width {
		verb.HasWidth = true
	}
	action width_reset {
		verb.Width = 0
	}
	action width_num {
		verb.Width = (10 * verb.Width) + (int(fc) - '0')
	}

	action has_prec {
		verb.HasPrec = true
	}
	action prec_reset {
		verb.Prec = 0
	}
	action prec_num {
		verb.Prec = (10 * verb.Prec) + (int(fc) - '0')
	}

	action mode {
		verb.Mode = rune(fc)
		te = p+1
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
	}

	# a number that isn't zero and doesn't have a leading zero
	num = [1-9] [0-9]*;

	flags = (
		'0' @flag_zero |
		'#' @flag_sharp |
		'-' @flag_minus |
		'+' @flag_plus |
		' ' @flag_space
	)*;

	argidx = ((
		'[' (num $argidx_num) ']'
	) >argidx_reset)?;

	width = (
		( num $width_num ) >width_reset %has_width
	)?;

	precision = (
		('.' ( digit* $prec_num )) >prec_reset %has_prec
	)?;

	# We accept any letter here, but will be more picky in formatAppend
	mode = ('a'..'z' | 'A'..'Z') @mode;

	fmt_verb = (
		'%' @begin
		flags
		width
		precision
		argidx
		mode
	);

	main := (
		[^%] @emit |
		'%%' @emit |
		fmt_verb
	)* @/finish_err %/finish_ok $!err_char;

	}%%

	// Ragel state
	p := 0  // "Pointer" into data
	pe := len(data) // End-of-data "pointer"
	cs := 0 // current state (will be initialized by ragel-generated code)
	ts := 0
	te := 0
	eof := pe

	// Keep Go compiler happy even if generated code doesn't use these
	_ = ts
	_ = te
	_ = eof

	%%{
		write init;
		write exec;
	}%%

	// If we fall out here without being in a final state then we've
	// encountered something that the scanner can't match, which should
	// be impossible (the scanner matches all bytes _somehow_) but we'll
	// flag it anyway rather than just losing data from the end.
	if cs < formatfsm_first_final {
		return buf.String(), fmt.Errorf("extraneous characters beginning at offset %d", p)
	}

	if highestArgIdx < len(a) {
		// Extraneous args are an error, to more easily detect mistakes
		firstBad := highestArgIdx+1
		if highestArgIdx == 0 {
			// Custom error message for this case
			return buf.String(), function.NewArgErrorf(firstBad, "too many arguments; no verbs in format string")
		}
		return buf.String(), function.NewArgErrorf(firstBad, "too many arguments; only %d used by format string", highestArgIdx)
	}

	return buf.String(), nil
}
