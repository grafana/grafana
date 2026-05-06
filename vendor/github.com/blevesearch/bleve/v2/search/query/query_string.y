%{
package query
import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func logDebugGrammar(format string, v ...interface{}) {
	if debugParser {
    	logger.Printf(format, v...)
    }
}
%}

%union {
s string
n int
f float64
q Query
pf *float64}

%token tSTRING tPHRASE tPLUS tMINUS tCOLON tBOOST tNUMBER tSTRING tGREATER tLESS
tEQUAL tTILDE

%type <s>                tSTRING
%type <s>                tPHRASE
%type <s>                tNUMBER
%type <s>                posOrNegNumber
%type <s>                fieldName
%type <s>                tTILDE
%type <s>                tBOOST
%type <q>                searchBase
%type <pf>               searchSuffix
%type <n>                searchPrefix

%%

input:
searchParts {
	logDebugGrammar("INPUT")
};

searchParts:
searchPart searchParts {
	logDebugGrammar("SEARCH PARTS")
}
|
searchPart {
	logDebugGrammar("SEARCH PART")
};

searchPart:
searchPrefix searchBase searchSuffix {
	query := $2
	if $3 != nil {
		if query, ok := query.(BoostableQuery); ok {
			query.SetBoost(*$3)
			}
	}
	switch($1) {
		case queryShould:
			yylex.(*lexerWrapper).query.AddShould(query)
		case queryMust:
			yylex.(*lexerWrapper).query.AddMust(query)
		case queryMustNot:
			yylex.(*lexerWrapper).query.AddMustNot(query)
	}
};


searchPrefix:
/* empty */ {
	$$ = queryShould
}
|
tPLUS {
	logDebugGrammar("PLUS")
	$$ = queryMust
}
|
tMINUS {
	logDebugGrammar("MINUS")
	$$ = queryMustNot
};

searchBase:
tSTRING {
	str := $1
	logDebugGrammar("STRING - %s", str)
	var q FieldableQuery
	if strings.HasPrefix(str, "/") && strings.HasSuffix(str, "/") {
	  q = NewRegexpQuery(str[1:len(str)-1])
	} else if strings.ContainsAny(str, "*?"){
	  q = NewWildcardQuery(str)
	} else {
	  q = NewMatchQuery(str)
	}
	$$ = q
}
|
tSTRING tTILDE {
	str := $1
	fuzziness, err := strconv.ParseFloat($2, 64)
	if err != nil {
	  yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("invalid fuzziness value: %v", err))
	}
	logDebugGrammar("FUZZY STRING - %s %f", str, fuzziness)
	q := NewMatchQuery(str)
	q.SetFuzziness(int(fuzziness))
	$$ = q
}
|
fieldName tCOLON tSTRING tTILDE {
	field := $1
	str := $3
	fuzziness, err := strconv.ParseFloat($4, 64)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("invalid fuzziness value: %v", err))
	}
	logDebugGrammar("FIELD - %s FUZZY STRING - %s %f", field, str, fuzziness)
	q := NewMatchQuery(str)
	q.SetFuzziness(int(fuzziness))
	q.SetField(field)
	$$ = q
}
|
tNUMBER {
	str := $1
	logDebugGrammar("STRING - %s", str)
	q1 := NewMatchQuery(str)
	val, err := strconv.ParseFloat($1, 64)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("error parsing number: %v", err))
	}
	inclusive := true
	q2 := NewNumericRangeInclusiveQuery(&val, &val, &inclusive, &inclusive)
	q := NewDisjunctionQuery([]Query{q1,q2})
	q.queryStringMode = true
	$$ = q
}
|
tPHRASE {
	phrase := $1
	logDebugGrammar("PHRASE - %s", phrase)
	q := NewMatchPhraseQuery(phrase)
	$$ = q
}
|
fieldName tCOLON tSTRING {
	field := $1
	str := $3
	logDebugGrammar("FIELD - %s STRING - %s", field, str)
	var q FieldableQuery
	if strings.HasPrefix(str, "/") && strings.HasSuffix(str, "/") {
		q = NewRegexpQuery(str[1:len(str)-1])
	} else if strings.ContainsAny(str, "*?"){
	  q = NewWildcardQuery(str)
	}  else {
		q = NewMatchQuery(str)
	}
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON posOrNegNumber {
	field := $1
	str := $3
	logDebugGrammar("FIELD - %s STRING - %s", field, str)
	q1 := NewMatchQuery(str)
	q1.SetField(field)
	val, err := strconv.ParseFloat($3, 64)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("error parsing number: %v", err))
	}
	inclusive := true
	q2 := NewNumericRangeInclusiveQuery(&val, &val, &inclusive, &inclusive)
	q2.SetField(field)
	q := NewDisjunctionQuery([]Query{q1,q2})
	q.queryStringMode = true
	$$ = q
}
|
fieldName tCOLON tPHRASE {
	field := $1
	phrase := $3
	logDebugGrammar("FIELD - %s PHRASE - %s", field, phrase)
	q := NewMatchPhraseQuery(phrase)
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON tGREATER posOrNegNumber {
	field := $1
	min, err := strconv.ParseFloat($4, 64)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("error parsing number: %v", err))
	}
	minInclusive := false
	logDebugGrammar("FIELD - GREATER THAN %f", min)
	q := NewNumericRangeInclusiveQuery(&min, nil, &minInclusive, nil)
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON tGREATER tEQUAL posOrNegNumber {
	field := $1
	min, err := strconv.ParseFloat($5, 64)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("error parsing number: %v", err))
	}
	minInclusive := true
	logDebugGrammar("FIELD - GREATER THAN OR EQUAL %f", min)
	q := NewNumericRangeInclusiveQuery(&min, nil, &minInclusive, nil)
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON tLESS posOrNegNumber {
	field := $1
	max, err := strconv.ParseFloat($4, 64)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("error parsing number: %v", err))
	}
	maxInclusive := false
	logDebugGrammar("FIELD - LESS THAN %f", max)
	q := NewNumericRangeInclusiveQuery(nil, &max, nil, &maxInclusive)
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON tLESS tEQUAL posOrNegNumber {
	field := $1
	max, err := strconv.ParseFloat($5, 64)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("error parsing number: %v", err))
	}
	maxInclusive := true
	logDebugGrammar("FIELD - LESS THAN OR EQUAL %f", max)
	q := NewNumericRangeInclusiveQuery(nil, &max, nil, &maxInclusive)
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON tGREATER tPHRASE {
	field := $1
	minInclusive := false
	phrase := $4

	logDebugGrammar("FIELD - GREATER THAN DATE %s", phrase)
	minTime, err := queryTimeFromString(phrase)
	if err != nil {
	  yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("invalid time: %v", err))
	}
	q := NewDateRangeInclusiveQuery(minTime, time.Time{}, &minInclusive, nil)
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON tGREATER tEQUAL tPHRASE {
	field := $1
	minInclusive := true
	phrase := $5

	logDebugGrammar("FIELD - GREATER THAN OR EQUAL DATE %s", phrase)
	minTime, err := queryTimeFromString(phrase)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("invalid time: %v", err))
	}
	q := NewDateRangeInclusiveQuery(minTime, time.Time{}, &minInclusive, nil)
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON tLESS tPHRASE {
	field := $1
	maxInclusive := false
	phrase := $4

	logDebugGrammar("FIELD - LESS THAN DATE %s", phrase)
	maxTime, err := queryTimeFromString(phrase)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("invalid time: %v", err))
	}
	q := NewDateRangeInclusiveQuery(time.Time{}, maxTime, nil, &maxInclusive)
	q.SetField(field)
	$$ = q
}
|
fieldName tCOLON tLESS tEQUAL tPHRASE {
	field := $1
	maxInclusive := true
	phrase := $5

	logDebugGrammar("FIELD - LESS THAN OR EQUAL DATE %s", phrase)
	maxTime, err := queryTimeFromString(phrase)
	if err != nil {
		yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("invalid time: %v", err))
	}
	q := NewDateRangeInclusiveQuery(time.Time{}, maxTime, nil, &maxInclusive)
	q.SetField(field)
	$$ = q
};

searchSuffix:
/* empty */ {
	$$ = nil
}
|
tBOOST {
  $$ = nil
	boost, err := strconv.ParseFloat($1, 64)
	if err != nil {
	  yylex.(*lexerWrapper).lex.Error(fmt.Sprintf("invalid boost value: %v", err))
	} else {
		$$ = &boost
	}
	logDebugGrammar("BOOST %f", boost)
};

posOrNegNumber:
tNUMBER {
	$$ = $1
}
|
tMINUS tNUMBER {
	$$ = "-" + $2
};

fieldName:
tPHRASE {
    $$ = $1
}
|
tSTRING {
    $$ = $1
};
