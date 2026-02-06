package textseg

import (
    "errors"
    "unicode/utf8"
)

// Generated from grapheme_clusters.rl. DO NOT EDIT
%%{
  # (except you are actually in grapheme_clusters.rl here, so edit away!)

  machine graphclust;
  write data;
}%%

var Error = errors.New("invalid UTF8 text")

// ScanGraphemeClusters is a split function for bufio.Scanner that splits
// on grapheme cluster boundaries.
func ScanGraphemeClusters(data []byte, atEOF bool) (int, []byte, error) {
    if len(data) == 0 {
        return 0, nil, nil
    }

    // Ragel state
	cs := 0 // Current State
	p := 0  // "Pointer" into data
	pe := len(data) // End-of-data "pointer"
    ts := 0
    te := 0
    act := 0
    eof := pe

    // Make Go compiler happy
    _ = ts
    _ = te
    _ = act
    _ = eof

    startPos := 0
    endPos := 0

    %%{
        include GraphemeCluster "grapheme_clusters_table.rl";
        include Emoji "emoji_table.rl";

        action start {
            startPos = p
        }

        action end {
            endPos = p
        }

        action emit {
            return endPos+1, data[startPos:endPos+1], nil
        }

        ZWJGlue = ZWJ (Extended_Pictographic Extend*)?;
        AnyExtender = Extend | ZWJGlue | SpacingMark;
        Extension = AnyExtender*;
        ReplacementChar = (0xEF 0xBF 0xBD);

        CRLFSeq = CR LF;
        ControlSeq = Control | ReplacementChar;
        HangulSeq = (
            L+ (((LV? V+ | LVT) T*)?|LV?) |
            LV V* T* |
            V+ T* |
            LVT T* |
            T+
        ) Extension;
        EmojiSeq = Extended_Pictographic Extend* Extension;
        ZWJSeq = ZWJ (ZWJ | Extend | SpacingMark)*;
        EmojiFlagSeq = Regional_Indicator Regional_Indicator? Extension;

        UTF8Cont = 0x80 .. 0xBF;
        AnyUTF8 = (
            0x00..0x7F |
            0xC0..0xDF . UTF8Cont |
            0xE0..0xEF . UTF8Cont . UTF8Cont |
            0xF0..0xF7 . UTF8Cont . UTF8Cont . UTF8Cont
        );

        # OtherSeq is any character that isn't at the start of one of the extended sequences above, followed by extension
        OtherSeq = (AnyUTF8 - (CR|LF|Control|ReplacementChar|L|LV|V|LVT|T|Extended_Pictographic|ZWJ|Regional_Indicator|Prepend)) (Extend | ZWJ | SpacingMark)*;

        # PrependSeq is prepend followed by any of the other patterns above, except control characters which explicitly break
        PrependSeq = Prepend+ (HangulSeq|EmojiSeq|ZWJSeq|EmojiFlagSeq|OtherSeq)?;

        CRLFTok = CRLFSeq >start @end;
        ControlTok = ControlSeq >start @end;
        HangulTok = HangulSeq >start @end;
        EmojiTok = EmojiSeq >start @end;
        ZWJTok = ZWJSeq >start @end;
        EmojiFlagTok = EmojiFlagSeq >start @end;
        OtherTok = OtherSeq >start @end;
        PrependTok = PrependSeq >start @end;

        main := |*
            CRLFTok => emit;
            ControlTok => emit;
            HangulTok => emit;
            EmojiTok => emit;
            ZWJTok => emit;
            EmojiFlagTok => emit;
            PrependTok => emit;
            OtherTok => emit;

            # any single valid UTF-8 character would also be valid per spec,
            # but we'll handle that separately after the loop so we can deal
            # with requesting more bytes if we're not at EOF.
        *|;

        write init;
        write exec;
    }%%

    // If we fall out here then we were unable to complete a sequence.
    // If we weren't able to complete a sequence then either we've
    // reached the end of a partial buffer (so there's more data to come)
    // or we have an isolated symbol that would normally be part of a
    // grapheme cluster but has appeared in isolation here.

    if !atEOF {
        // Request more
        return 0, nil, nil
    }

    // Just take the first UTF-8 sequence and return that.
    _, seqLen := utf8.DecodeRune(data)
    return seqLen, data[:seqLen], nil
}