//  Copyright (c) 2015 Couchbase, Inc.
//  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
//  except in compliance with the License. You may obtain a copy of the License at
//    http://www.apache.org/licenses/LICENSE-2.0
//  Unless required by applicable law or agreed to in writing, software distributed under the
//  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
//  either express or implied. See the License for the specific language governing permissions
//  and limitations under the License.

// +build BUILDTAGS

package segment

import (
  "fmt"
  "unicode/utf8"
)

var RagelFlags = "RAGELFLAGS"

var ParseError = fmt.Errorf("unicode word segmentation parse error")

// Word Types
const (
  None = iota
  Number
  Letter
  Kana
  Ideo
)

%%{
  machine s;
  write data;
}%%

func segmentWords(data []byte, maxTokens int, atEOF bool, val [][]byte, types []int) ([][]byte, []int, int, error) {
  cs, p, pe := 0, 0, len(data)
  cap := maxTokens
  if cap < 0 {
    cap = 1000
  }
  if val == nil {
    val = make([][]byte, 0, cap)
  }
  if types == nil {
    types = make([]int, 0, cap)
  }

  // added for scanner
  ts := 0
  te := 0
  act := 0
  eof := pe
  _ = ts // compiler not happy
  _ = te
  _ = act

  // our state
  startPos := 0
  endPos := 0
  totalConsumed := 0
  %%{

  include SCRIPTS "ragel/uscript.rl";
  include WB "ragel/uwb.rl";

  action startToken {
    startPos = p
  }

  action endToken {
    endPos = p
  }

  action finishNumericToken {
    if !atEOF {
      return val, types, totalConsumed, nil
    }

    val = append(val, data[startPos:endPos+1])
    types = append(types, Number)
    totalConsumed = endPos+1
    if maxTokens > 0 && len(val) >= maxTokens {
      return val, types, totalConsumed, nil
    }
  }

  action finishHangulToken {
    if endPos+1 == pe && !atEOF {
      return val, types, totalConsumed, nil
    } else if dr, size := utf8.DecodeRune(data[endPos+1:]); dr == utf8.RuneError && size == 1 {
      return val, types, totalConsumed, nil
    }

    val = append(val, data[startPos:endPos+1])
    types = append(types, Letter)
    totalConsumed = endPos+1
    if maxTokens > 0 && len(val) >= maxTokens {
      return val, types, totalConsumed, nil
    }
  }

  action finishKatakanaToken {
    if endPos+1 == pe && !atEOF {
      return val, types, totalConsumed, nil
    } else if dr, size := utf8.DecodeRune(data[endPos+1:]); dr == utf8.RuneError && size == 1 {
      return val, types, totalConsumed, nil
    }

    val = append(val, data[startPos:endPos+1])
    types = append(types, Ideo)
    totalConsumed = endPos+1
    if maxTokens > 0 && len(val) >= maxTokens {
      return val, types, totalConsumed, nil
    }
  }

  action finishWordToken {
    if !atEOF {
      return val, types, totalConsumed, nil
    }
    val = append(val, data[startPos:endPos+1])
    types = append(types, Letter)
    totalConsumed = endPos+1
    if maxTokens > 0 && len(val) >= maxTokens {
      return val, types, totalConsumed, nil
    }
  }

  action finishHanToken {
    if endPos+1 == pe && !atEOF {
      return val, types, totalConsumed, nil
    } else if dr, size := utf8.DecodeRune(data[endPos+1:]); dr == utf8.RuneError && size == 1 {
      return val, types, totalConsumed, nil
    }

    val = append(val, data[startPos:endPos+1])
    types = append(types, Ideo)
    totalConsumed = endPos+1
    if maxTokens > 0 && len(val) >= maxTokens {
      return val, types, totalConsumed, nil
    }
  }

  action finishHiraganaToken {
    if endPos+1 == pe && !atEOF {
      return val, types, totalConsumed, nil
    } else if dr, size := utf8.DecodeRune(data[endPos+1:]); dr == utf8.RuneError && size == 1 {
      return val, types, totalConsumed, nil
    }

    val = append(val, data[startPos:endPos+1])
    types = append(types, Ideo)
    totalConsumed = endPos+1
    if maxTokens > 0 && len(val) >= maxTokens {
      return val, types, totalConsumed, nil
    }
  }

  action finishNoneToken {
    lastPos := startPos
    for lastPos <= endPos {
      _, size := utf8.DecodeRune(data[lastPos:])
      lastPos += size
    }
    endPos = lastPos -1
    p = endPos

    if endPos+1 == pe && !atEOF {
      return val, types, totalConsumed, nil
    } else if dr, size := utf8.DecodeRune(data[endPos+1:]); dr == utf8.RuneError && size == 1 {
      return val, types, totalConsumed, nil
    }
    // otherwise, consume this as well
    val = append(val, data[startPos:endPos+1])
    types = append(types, None)
    totalConsumed = endPos+1
    if maxTokens > 0 && len(val) >= maxTokens {
      return val, types, totalConsumed, nil
    }
  }

  HangulEx = Hangul ( Extend | Format )*;
  HebrewOrALetterEx = ( Hebrew_Letter | ALetter ) ( Extend | Format )*;
  NumericEx = Numeric ( Extend | Format )*;
  KatakanaEx = Katakana ( Extend | Format )*;
  MidLetterEx = ( MidLetter | MidNumLet | Single_Quote ) ( Extend | Format )*;
  MidNumericEx = ( MidNum | MidNumLet | Single_Quote ) ( Extend | Format )*;
  ExtendNumLetEx = ExtendNumLet ( Extend | Format )*;
  HanEx = Han ( Extend | Format )*;
  HiraganaEx = Hiragana ( Extend | Format )*;
  SingleQuoteEx = Single_Quote ( Extend | Format )*;
  DoubleQuoteEx = Double_Quote ( Extend | Format )*;
  HebrewLetterEx = Hebrew_Letter ( Extend | Format )*;
  RegionalIndicatorEx = Regional_Indicator ( Extend | Format )*;
  NLCRLF = Newline | CR | LF;
  OtherEx = ^(NLCRLF) ( Extend | Format )* ;

  # UAX#29 WB8.   Numeric × Numeric
  #        WB11.  Numeric (MidNum | MidNumLet | Single_Quote) × Numeric
  #       WB12.  Numeric × (MidNum | MidNumLet | Single_Quote) Numeric
  #       WB13a. (ALetter | Hebrew_Letter | Numeric | Katakana | ExtendNumLet) × ExtendNumLet
  #       WB13b. ExtendNumLet × (ALetter | Hebrew_Letter | Numeric | Katakana)
  #
  WordNumeric = ( ( ExtendNumLetEx )* NumericEx ( ( ( ExtendNumLetEx )* | MidNumericEx ) NumericEx )* ( ExtendNumLetEx )* ) >startToken @endToken;

  # subset of the below for typing purposes only!
  WordHangul = ( HangulEx )+ >startToken @endToken;
  WordKatakana = ( KatakanaEx )+ >startToken @endToken;

  # UAX#29 WB5.   (ALetter | Hebrew_Letter) × (ALetter | Hebrew_Letter)
  #       WB6.   (ALetter | Hebrew_Letter) × (MidLetter | MidNumLet | Single_Quote) (ALetter | Hebrew_Letter)
  #       WB7.   (ALetter | Hebrew_Letter) (MidLetter | MidNumLet | Single_Quote) × (ALetter | Hebrew_Letter)
  #       WB7a.  Hebrew_Letter × Single_Quote
  #       WB7b.  Hebrew_Letter × Double_Quote Hebrew_Letter
  #       WB7c.  Hebrew_Letter Double_Quote × Hebrew_Letter
  #       WB9.   (ALetter | Hebrew_Letter) × Numeric
  #       WB10.  Numeric × (ALetter | Hebrew_Letter)
  #       WB13.  Katakana × Katakana
  #       WB13a. (ALetter | Hebrew_Letter | Numeric | Katakana | ExtendNumLet) × ExtendNumLet
  #       WB13b. ExtendNumLet × (ALetter | Hebrew_Letter | Numeric | Katakana)
  #
  # Marty -deviated here to allow for (ExtendNumLetEx x ExtendNumLetEx) part of 13a
  #
  Word = ( ( ExtendNumLetEx )* ( KatakanaEx ( ( ExtendNumLetEx )* KatakanaEx )*
                             | ( HebrewLetterEx ( SingleQuoteEx | DoubleQuoteEx HebrewLetterEx )
                               | NumericEx ( ( ( ExtendNumLetEx )* | MidNumericEx ) NumericEx )*
                               | HebrewOrALetterEx ( ( ( ExtendNumLetEx )* | MidLetterEx ) HebrewOrALetterEx )*
                               |ExtendNumLetEx
                               )+
                             )
         (
          ( ExtendNumLetEx )+ ( KatakanaEx ( ( ExtendNumLetEx )* KatakanaEx )*
                              | ( HebrewLetterEx ( SingleQuoteEx | DoubleQuoteEx HebrewLetterEx )
                                | NumericEx ( ( ( ExtendNumLetEx )* | MidNumericEx ) NumericEx )*
                                | HebrewOrALetterEx ( ( ( ExtendNumLetEx )* | MidLetterEx ) HebrewOrALetterEx )*
                                )+
                              )
         )* ExtendNumLetEx*) >startToken @endToken;

  # UAX#29 WB14.  Any ÷ Any
  WordHan = HanEx >startToken @endToken;
  WordHiragana = HiraganaEx >startToken @endToken;

  WordExt = ( ( Extend | Format )* ) >startToken @endToken; # maybe plus not star

  WordCRLF = (CR LF) >startToken @endToken;

  WordCR = CR >startToken @endToken;

  WordLF = LF >startToken @endToken;

  WordNL = Newline >startToken @endToken;

  WordRegional = (RegionalIndicatorEx+) >startToken @endToken;

  Other = OtherEx >startToken @endToken;

  main := |*
    WordNumeric => finishNumericToken;
    WordHangul => finishHangulToken;
    WordKatakana => finishKatakanaToken;
    Word => finishWordToken;
    WordHan => finishHanToken;
    WordHiragana => finishHiraganaToken;
    WordRegional =>finishNoneToken;
    WordCRLF => finishNoneToken;
    WordCR => finishNoneToken;
    WordLF => finishNoneToken;
    WordNL => finishNoneToken;
    WordExt => finishNoneToken;
    Other => finishNoneToken;
  *|;

    write init;
    write exec;
  }%%

  if cs < s_first_final {
    return val, types, totalConsumed, ParseError
  }

  return val, types, totalConsumed, nil
}
