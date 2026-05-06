
package hclsyntax

// This file is generated from scan_string_lit.rl. DO NOT EDIT.
%%{
  # (except you are actually in scan_string_lit.rl here, so edit away!)

  machine hclstrtok;
  write data;
}%%

func scanStringLit(data []byte, quoted bool) [][]byte {
    var ret [][]byte

    %%{
        include UnicodeDerived "unicode_derived.rl";

        UTF8Cont = 0x80 .. 0xBF;
        AnyUTF8 = (
            0x00..0x7F |
            0xC0..0xDF . UTF8Cont |
            0xE0..0xEF . UTF8Cont . UTF8Cont |
            0xF0..0xF7 . UTF8Cont . UTF8Cont . UTF8Cont
        );
        BadUTF8 = any - AnyUTF8;

        Hex = ('0'..'9' | 'a'..'f' | 'A'..'F');

        # Our goal with this patterns is to capture user intent as best as
        # possible, even if the input is invalid. The caller will then verify
        # whether each token is valid and generate suitable error messages
        # if not.
        UnicodeEscapeShort = "\\u" . Hex{0,4};
        UnicodeEscapeLong = "\\U" . Hex{0,8};
        UnicodeEscape = (UnicodeEscapeShort | UnicodeEscapeLong);
        SimpleEscape = "\\" . (AnyUTF8 - ('U'|'u'))?;
        TemplateEscape = ("$" . ("$" . ("{"?))?) | ("%" . ("%" . ("{"?))?);
        Newline = ("\r\n" | "\r" | "\n");

        action Begin {
            // If te is behind p then we've skipped over some literal
            // characters which we must now return.
            if te < p {
                ret = append(ret, data[te:p])
            }
            ts = p;
        }
        action End {
            te = p;
            ret = append(ret, data[ts:te]);
        }

        QuotedToken = (UnicodeEscape | SimpleEscape | TemplateEscape | Newline) >Begin %End;
        UnquotedToken = (TemplateEscape | Newline) >Begin %End;
        QuotedLiteral = (any - ("\\" | "$" | "%" | "\r" | "\n"));
        UnquotedLiteral = (any - ("$" | "%" | "\r" | "\n"));

        quoted := (QuotedToken | QuotedLiteral)**;
        unquoted := (UnquotedToken | UnquotedLiteral)**;

    }%%

    // Ragel state
	p := 0  // "Pointer" into data
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

    %%{
        write init nocs;
        write exec;
    }%%

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
