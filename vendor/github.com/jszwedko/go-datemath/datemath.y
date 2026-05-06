/*
This file is used with goyacc to generate a parser.

See https://godoc.org/golang.org/x/tools/cmd/goyacc for more about goyacc.
*/

%{
package datemath

import (
	"fmt"
	"math"
	"time"
)

var epoch = time.Unix(0, 0).In(time.UTC)

// convert a list of significant digits to an integer
// assumes most to least significant
// e.g. 5,2,3 -> 523
func digitsToInt(digits ...int) int {
	n := 0
	for i := range digits {
		n += digits[i] * int(math.Pow10(len(digits)-i-1))
	}
	return n
}
%}

/* set of valid tokens; generated constants used by lexer */
%token tNOW tPLUS tMINUS tPIPES tBACKSLASH tTIME_DELIMITER tCOLON tDOT tUNIT tUTC tDIGIT tINVALID_TOKEN

/* Go variables to hold the corresponding token values */
%union {
i64 int64
i int
unit timeUnit
month time.Month

expression mathExpression
anchorDateExpression anchorDateExpression
timeAdjuster timeAdjuster
timeAdjusters []timeAdjuster

location *time.Location
time time.Time
}

/* associate tokens with Go types */
%type <unit> tUNIT
%type <i> sign factor number year day hour minute second nanoseconds tDIGIT
%type <month> month
%type <expression> expression
%type <time> date time absolute_date_expression
%type <i64> millitimestamp
%type <timeAdjusters> date_math_expressions
%type <timeAdjuster> date_math_expression
%type <location> timezone

%error start tINVALID_TOKEN :
  "invalid token"

%%

start : expression { // last rule; assign the evaluated time so we can use use it later
	yylex.(*lexerWrapper).expression = $1
}

/*
 * an expression can be either a:
 * * A ISO8601 timestamp (can be truncated)
 * * the string "now"
 *
 * followed by list of date math expressions
 */
expression :
	absolute_date_expression {
    $$ = newMathExpression(anchorDate($1), nil)
	}
	| absolute_date_expression tPIPES {
    $$ = newMathExpression(anchorDate($1), nil)
	}
	| absolute_date_expression tPIPES date_math_expressions {
    $$ = newMathExpression(anchorDate($1), $3)
	}
	| tNOW {
    $$ = newMathExpression(anchorDateNow, nil)
	}
	| tNOW date_math_expressions {
    $$ = newMathExpression(anchorDateNow, $2)
	}
;

/*
 * An absolute date expression can be:
 * * a unix timestamp in milliseconds
 * * a date
 * * a time
 * * a datetime
 * Dates and times can be truncated by leaving off smaller units. For example, 2006 would map to 2006-01-01T00:00:00
 */
absolute_date_expression :
  date {
    $$ = $1
  }
  |
  time {
    $$ = $1
  }
  |
  date tTIME_DELIMITER time timezone {
    $$ = time.Date($1.Year(), $1.Month(), $1.Day(), $3.Hour(), $3.Minute(), $3.Second(), $3.Nanosecond(), $4)
  }
  |
  millitimestamp {
    $$ = time.Unix($1 / 1000, $1%1000 * 1000000)
  }
  ;

timezone :
  /* empty */ {
    $$ = missingTimeZone
  }
  |
  sign tDIGIT tDIGIT tCOLON tDIGIT tDIGIT { /* support +/-09:00 style timezone specifiers */
    $$ = time.FixedZone("$1$2$3:$5$6", $1 * ((($2 * 10 + $3) * 60 * 60) + (($5 * 10 + $6) * 60)))
  }
  |
  tUTC { /* Z */
    $$ = time.UTC
  }
  ;

date :
  year {
    $$ = time.Date($1, 1, 1, 0, 0, 0, 0, missingTimeZone)
  }
  |
  year tMINUS month {
    $$ = time.Date($1, $3, 1, 0, 0, 0, 0, missingTimeZone)
  }
  |
  year tMINUS month tMINUS day {
    if $5 > daysIn($3, $1) {
      yylex.Error(fmt.Sprintf("day %d out of bounds for month %d", $5, $3))
    }
    $$ = time.Date($1, $3, $5, 0, 0, 0, 0, missingTimeZone)
  }
  ;

/* store in a time.Time struct using the epoch for the year/month/day */
time :
  hour {
    $$ = time.Date(epoch.Year(), epoch.Month(), epoch.Day(), $1, 0, 0, 0, missingTimeZone)
  }
  |
  hour tCOLON minute {
    $$ = time.Date(epoch.Year(), epoch.Month(), epoch.Day(), $1, $3, 0, 0, missingTimeZone)
  }
  |
  hour tCOLON minute tCOLON second {
    $$ = time.Date(epoch.Year(), epoch.Month(), epoch.Day(), $1, $3, $5, 0, missingTimeZone)
  }
  |
  hour tCOLON minute tCOLON second tDOT nanoseconds {
    $$ = time.Date(epoch.Year(), epoch.Month(), epoch.Day(), $1, $3, $5, $7, missingTimeZone)
  }
  ;

year :
  tDIGIT tDIGIT tDIGIT tDIGIT {
    $$ = digitsToInt($1, $2, $3, $4)
  }
  ;

month:
  tDIGIT tDIGIT {
    $$ = time.Month(digitsToInt($1, $2))
    if $$ > 12 {
      yylex.Error(fmt.Sprintf("month out of bounds %d", $$))
    }
  }
  ;

day:
  tDIGIT tDIGIT {
    // range validated in `date`
    $$ = digitsToInt($1, $2)
  }
  ;

hour:
  tDIGIT tDIGIT {
    $$ = digitsToInt($1, $2)
    if $$ > 23 {
      yylex.Error(fmt.Sprintf("hours out of bounds %d", $$))
    }
  }
  ;

minute:
  tDIGIT tDIGIT {
    $$ = digitsToInt($1, $2)
    if $$ > 59 {
      yylex.Error(fmt.Sprintf("minutes out of bounds %d", $$))
    }
  }
  ;

second:
  tDIGIT tDIGIT {
    $$ = digitsToInt($1, $2)
    if $$ > 59 {
      yylex.Error(fmt.Sprintf("seconds out of bounds %d", $$))
    }
  }
  ;

/* only supports 3 digits for fractional seconds for now */
nanoseconds:
   tDIGIT {
      $$ = $1 * 100000000
   }
   |
   tDIGIT tDIGIT {
      $$ = digitsToInt($1, $2) * 10000000
   }
   |
   tDIGIT tDIGIT tDIGIT {
      $$ = digitsToInt($1, $2, $3) * 1000000
   }
   ;

/* allow for list of time adjustments; evaluated from left to right */
date_math_expressions :
	date_math_expression date_math_expressions {
    $$ = append([]timeAdjuster{$1}, $2...)
    /*f, g := $1, $2 // bind to local scope*/
    /*$$ = func(t time.Time) time.Time {*/
      /*return g(f(t))*/
    /*}*/
  }
  |
	date_math_expression {
    $$ = []timeAdjuster{$1}
  }
  ;

date_math_expression :
	sign factor tUNIT { /* add units; e.g. +15m */
    $$ = addUnits($1 * $2, $3)
	}
  |
	tBACKSLASH tUNIT { /* truncate to specified unit: e.g. /d */
    $$ = truncateUnits($2)
	}
	;

sign :
	tMINUS {
    $$ = -1
  }
  |
	tPLUS {
    $$ = 1
  }
  ;

factor :
  /* empty */ { /* default to 1 if no integer specified */
    $$ = 1
  }
  |
	number {
		$$ = $1
	}
  ;

number :
  tDIGIT {
    $$ = $1
  }
  |
  number tDIGIT {
    $$ = $1 * 10 + $2
  }
  ;

/* 5 digits or longer is considered a timestamp */
millitimestamp:
  tDIGIT tDIGIT tDIGIT tDIGIT tDIGIT {
    $$ = int64(digitsToInt($1, $2, $3, $4, $5))
  }
  |
  millitimestamp tDIGIT {
    $$ = $1 * 10 + int64($2)
  }
  ;

%%
