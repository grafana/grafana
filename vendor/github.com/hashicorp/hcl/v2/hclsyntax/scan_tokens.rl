// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
    "bytes"

    "github.com/hashicorp/hcl/v2"
)

// This file is generated from scan_tokens.rl. DO NOT EDIT.
%%{
  # (except when you are actually in scan_tokens.rl here, so edit away!)

  machine hcltok;
  write data;
}%%

func scanTokens(data []byte, filename string, start hcl.Pos, mode scanMode) []Token {
    stripData := stripUTF8BOM(data)
    start.Byte += len(data) - len(stripData)
    data = stripData

    f := &tokenAccum{
        Filename:  filename,
        Bytes:     data,
        Pos:       start,
        StartByte: start.Byte,
    }

    %%{
        include UnicodeDerived "unicode_derived.rl";

        UTF8Cont = 0x80 .. 0xBF;
        AnyUTF8 = (
            0x00..0x7F |
            0xC0..0xDF . UTF8Cont |
            0xE0..0xEF . UTF8Cont . UTF8Cont |
            0xF0..0xF7 . UTF8Cont . UTF8Cont . UTF8Cont
        );
        BrokenUTF8 = any - AnyUTF8;

        NumberLitContinue = (digit|'.'|('e'|'E') ('+'|'-')? digit);
        NumberLit = digit ("" | (NumberLitContinue - '.') | (NumberLitContinue* (NumberLitContinue - '.')));
        Ident = (ID_Start | '_') (ID_Continue | '-')*;

        # Symbols that just represent themselves are handled as a single rule.
        SelfToken = "[" | "]" | "(" | ")" | "." | "," | "*" | "/" | "%" | "+" | "-" | "=" | "<" | ">" | "!" | "?" | ":" | "\n" | "&" | "|" | "~" | "^" | ";" | "`" | "'";

        EqualOp = "==";
        NotEqual = "!=";
        GreaterThanEqual = ">=";
        LessThanEqual = "<=";
        LogicalAnd = "&&";
        LogicalOr = "||";

        DoubleColon = "::";
        Ellipsis = "...";
        FatArrow = "=>";

        Newline = '\r' ? '\n';
        EndOfLine = Newline;

        BeginStringTmpl = '"';
        BeginHeredocTmpl = '<<' ('-')? Ident Newline;

        Comment = (
            # The :>> operator in these is a "finish-guarded concatenation",
            # which terminates the sequence on its left when it completes
            # the sequence on its right.
            # In the single-line comment cases this is allowing us to make
            # the trailing EndOfLine optional while still having the overall
            # pattern terminate. In the multi-line case it ensures that
            # the first comment in the file ends at the first */, rather than
            # gobbling up all of the "any*" until the _final_ */ in the file.
            ("#" (any - EndOfLine)* :>> EndOfLine?) |
            ("//" (any - EndOfLine)* :>> EndOfLine?) |
            ("/*" any* :>> "*/")
        );

        # Note: hclwrite assumes that only ASCII spaces appear between tokens,
        # and uses this assumption to recreate the spaces between tokens by
        # looking at byte offset differences. This means it will produce
        # incorrect results in the presence of tabs, but that's acceptable
        # because the canonical style (which hclwrite itself can impose
        # automatically is to never use tabs).
        Spaces = (' ' | 0x09)+;

        action beginStringTemplate {
            token(TokenOQuote);
            fcall stringTemplate;
        }

        action endStringTemplate {
            token(TokenCQuote);
            fret;
        }

        action beginHeredocTemplate {
            token(TokenOHeredoc);
            // the token is currently the whole heredoc introducer, like
            // <<EOT or <<-EOT, followed by a newline. We want to extract
            // just the "EOT" portion that we'll use as the closing marker.

            marker := data[ts+2:te-1]
            if marker[0] == '-' {
                marker = marker[1:]
            }
            if marker[len(marker)-1] == '\r' {
                marker = marker[:len(marker)-1]
            }

            heredocs = append(heredocs, heredocInProgress{
                Marker:      marker,
                StartOfLine: true,
            })

            fcall heredocTemplate;
        }

        action heredocLiteralEOL {
            // This action is called specificially when a heredoc literal
            // ends with a newline character.

            // This might actually be our end marker.
            topdoc := &heredocs[len(heredocs)-1]
            if topdoc.StartOfLine {
                maybeMarker := bytes.TrimSpace(data[ts:te])
                if bytes.Equal(maybeMarker, topdoc.Marker) {
                    // We actually emit two tokens here: the end-of-heredoc
                    // marker first, and then separately the newline that
                    // follows it. This then avoids issues with the closing
                    // marker consuming a newline that would normally be used
                    // to mark the end of an attribute definition.
                    // We might have either a \n sequence or an \r\n sequence
                    // here, so we must handle both.
                    nls := te-1
                    nle := te
                    te--
                    if data[te-1] == '\r' {
                        // back up one more byte
                        nls--
                        te--
                    }
                    token(TokenCHeredoc);
                    ts = nls
                    te = nle
                    token(TokenNewline);
                    heredocs = heredocs[:len(heredocs)-1]
                    fret;
                }
            }

            topdoc.StartOfLine = true;
            token(TokenStringLit);
        }

        action heredocLiteralMidline {
            // This action is called when a heredoc literal _doesn't_ end
            // with a newline character, e.g. because we're about to enter
            // an interpolation sequence.
            heredocs[len(heredocs)-1].StartOfLine = false;
            token(TokenStringLit);
        }

        action bareTemplateLiteral {
            token(TokenStringLit);
        }

        action beginTemplateInterp {
            token(TokenTemplateInterp);
            braces++;
            retBraces = append(retBraces, braces);
            if len(heredocs) > 0 {
                heredocs[len(heredocs)-1].StartOfLine = false;
            }
            fcall main;
        }

        action beginTemplateControl {
            token(TokenTemplateControl);
            braces++;
            retBraces = append(retBraces, braces);
            if len(heredocs) > 0 {
                heredocs[len(heredocs)-1].StartOfLine = false;
            }
            fcall main;
        }

        action openBrace {
            token(TokenOBrace);
            braces++;
        }

        action closeBrace {
            if len(retBraces) > 0 && retBraces[len(retBraces)-1] == braces {
                token(TokenTemplateSeqEnd);
                braces--;
                retBraces = retBraces[0:len(retBraces)-1]
                fret;
            } else {
                token(TokenCBrace);
                braces--;
            }
        }

        action closeTemplateSeqEatWhitespace {
            // Only consume from the retBraces stack and return if we are at
            // a suitable brace nesting level, otherwise things will get
            // confused. (Not entering this branch indicates a syntax error,
            // which we will catch in the parser.)
            if len(retBraces) > 0 && retBraces[len(retBraces)-1] == braces {
                token(TokenTemplateSeqEnd);
                braces--;
                retBraces = retBraces[0:len(retBraces)-1]
                fret;
            } else {
                // We intentionally generate a TokenTemplateSeqEnd here,
                // even though the user apparently wanted a brace, because
                // we want to allow the parser to catch the incorrect use
                // of a ~} to balance a generic opening brace, rather than
                // a template sequence.
                token(TokenTemplateSeqEnd);
                braces--;
            }
        }

        TemplateInterp = "${" ("~")?;
        TemplateControl = "%{" ("~")?;
        EndStringTmpl = '"';
        NewlineChars = ("\r"|"\n");
        NewlineCharsSeq = NewlineChars+;
        StringLiteralChars = (AnyUTF8 - NewlineChars);
        TemplateIgnoredNonBrace = (^'{' %{ fhold; });
        TemplateNotInterp = '$' (TemplateIgnoredNonBrace | TemplateInterp);
        TemplateNotControl = '%' (TemplateIgnoredNonBrace | TemplateControl);
        QuotedStringLiteralWithEsc = ('\\' StringLiteralChars) | (StringLiteralChars - ("$" | '%' | '"' | "\\"));
        TemplateStringLiteral = (
            (TemplateNotInterp) |
            (TemplateNotControl) |
            (QuotedStringLiteralWithEsc)+
        );
        HeredocStringLiteral = (
            (TemplateNotInterp) |
            (TemplateNotControl) |
            (StringLiteralChars - ("$" | '%'))*
        );
        BareStringLiteral = (
            (TemplateNotInterp) |
            (TemplateNotControl) |
            (StringLiteralChars - ("$" | '%'))*
        ) Newline?;

        stringTemplate := |*
            TemplateInterp        => beginTemplateInterp;
            TemplateControl       => beginTemplateControl;
            EndStringTmpl         => endStringTemplate;
            TemplateStringLiteral => { token(TokenQuotedLit); };
            NewlineCharsSeq       => { token(TokenQuotedNewline); };
            AnyUTF8               => { token(TokenInvalid); };
            BrokenUTF8            => { token(TokenBadUTF8); };
        *|;

        heredocTemplate := |*
            TemplateInterp        => beginTemplateInterp;
            TemplateControl       => beginTemplateControl;
            HeredocStringLiteral EndOfLine => heredocLiteralEOL;
            HeredocStringLiteral  => heredocLiteralMidline;
            BrokenUTF8            => { token(TokenBadUTF8); };
        *|;

        bareTemplate := |*
            TemplateInterp        => beginTemplateInterp;
            TemplateControl       => beginTemplateControl;
            BareStringLiteral     => bareTemplateLiteral;
            BrokenUTF8            => { token(TokenBadUTF8); };
        *|;

        identOnly := |*
            Ident            => { token(TokenIdent) };
            BrokenUTF8       => { token(TokenBadUTF8) };
            AnyUTF8          => { token(TokenInvalid) };
        *|;

        main := |*
            Spaces           => {};
            NumberLit        => { token(TokenNumberLit) };
            Ident            => { token(TokenIdent) };

            Comment          => { token(TokenComment) };
            Newline          => { token(TokenNewline) };

            EqualOp          => { token(TokenEqualOp); };
            NotEqual         => { token(TokenNotEqual); };
            GreaterThanEqual => { token(TokenGreaterThanEq); };
            LessThanEqual    => { token(TokenLessThanEq); };
            LogicalAnd       => { token(TokenAnd); };
            LogicalOr        => { token(TokenOr); };
            DoubleColon      => { token(TokenDoubleColon); };
            Ellipsis         => { token(TokenEllipsis); };
            FatArrow         => { token(TokenFatArrow); };
            SelfToken        => { selfToken() };

            "{"              => openBrace;
            "}"              => closeBrace;

            "~}"             => closeTemplateSeqEatWhitespace;

            BeginStringTmpl  => beginStringTemplate;
            BeginHeredocTmpl => beginHeredocTemplate;

            BrokenUTF8       => { token(TokenBadUTF8) };
            AnyUTF8          => { token(TokenInvalid) };
        *|;

    }%%

    // Ragel state
	p := 0  // "Pointer" into data
	pe := len(data) // End-of-data "pointer"
    ts := 0
    te := 0
    act := 0
    eof := pe
    var stack []int
    var top int

    var cs int // current state
    switch mode {
    case scanNormal:
        cs = hcltok_en_main
    case scanTemplate:
        cs = hcltok_en_bareTemplate
    case scanIdentOnly:
        cs = hcltok_en_identOnly
    default:
        panic("invalid scanMode")
    }

    braces := 0
    var retBraces []int // stack of brace levels that cause us to use fret
    var heredocs []heredocInProgress // stack of heredocs we're currently processing

    %%{
        prepush {
            stack = append(stack, 0);
        }
        postpop {
            stack = stack[:len(stack)-1];
        }
    }%%

    // Make Go compiler happy
    _ = ts
    _ = te
    _ = act
    _ = eof

    token := func (ty TokenType) {
        f.emitToken(ty, ts, te)
    }
    selfToken := func () {
        b := data[ts:te]
        if len(b) != 1 {
            // should never happen
            panic("selfToken only works for single-character tokens")
        }
        f.emitToken(TokenType(b[0]), ts, te)
    }

    %%{
        write init nocs;
        write exec;
    }%%

    // If we fall out here without being in a final state then we've
    // encountered something that the scanner can't match, which we'll
    // deal with as an invalid.
    if cs < hcltok_first_final {
        if mode == scanTemplate && len(stack) == 0 {
            // If we're scanning a bare template then any straggling
            // top-level stuff is actually literal string, rather than
            // invalid. This handles the case where the template ends
            // with a single "$" or "%", which trips us up because we
            // want to see another character to decide if it's a sequence
            // or an escape.
            f.emitToken(TokenStringLit, ts, len(data))
        } else {
            f.emitToken(TokenInvalid, ts, len(data))
        }
    }

    // We always emit a synthetic EOF token at the end, since it gives the
    // parser position information for an "unexpected EOF" diagnostic.
    f.emitToken(TokenEOF, len(data), len(data))

    return f.Tokens
}
