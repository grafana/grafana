// Copyright 2019 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

%{
package parser

import (
        "math"
        "strconv"
        "time"

        "github.com/prometheus/prometheus/model/labels"
        "github.com/prometheus/prometheus/model/value"
        "github.com/prometheus/prometheus/model/histogram"
        "github.com/prometheus/prometheus/promql/parser/posrange"

        "github.com/prometheus/common/model"
)

%}

%union {
    node        Node
    item        Item
    matchers    []*labels.Matcher
    matcher     *labels.Matcher
    label       labels.Label
    labels      labels.Labels
    lblList     []labels.Label
    strings     []string
    series      []SequenceValue
    histogram   *histogram.FloatHistogram
    descriptors map[string]interface{}
    bucket_set  []float64
    int         int64
    uint        uint64
    float       float64
}


%token <item>
EQL
BLANK
COLON
COMMA
COMMENT
DURATION
EOF
ERROR
IDENTIFIER
LEFT_BRACE
LEFT_BRACKET
LEFT_PAREN
OPEN_HIST
CLOSE_HIST
METRIC_IDENTIFIER
NUMBER
RIGHT_BRACE
RIGHT_BRACKET
RIGHT_PAREN
SEMICOLON
SPACE
STRING
TIMES

// Histogram Descriptors.
%token histogramDescStart
%token <item>
SUM_DESC
COUNT_DESC
SCHEMA_DESC
OFFSET_DESC
NEGATIVE_OFFSET_DESC
BUCKETS_DESC
NEGATIVE_BUCKETS_DESC
ZERO_BUCKET_DESC
ZERO_BUCKET_WIDTH_DESC
CUSTOM_VALUES_DESC
COUNTER_RESET_HINT_DESC
%token histogramDescEnd

// Operators.
%token	operatorsStart
%token <item>
ADD
DIV
EQLC
EQL_REGEX
GTE
GTR
LAND
LOR
LSS
LTE
LUNLESS
MOD
MUL
NEQ
NEQ_REGEX
POW
SUB
AT
ATAN2
%token	operatorsEnd

// Aggregators.
%token	aggregatorsStart
%token <item>
AVG
BOTTOMK
COUNT
COUNT_VALUES
GROUP
MAX
MIN
QUANTILE
STDDEV
STDVAR
SUM
TOPK
LIMITK
LIMIT_RATIO
%token	aggregatorsEnd

// Keywords.
%token	keywordsStart
%token <item>
BOOL
BY
GROUP_LEFT
GROUP_RIGHT
IGNORING
OFFSET
ON
WITHOUT
%token keywordsEnd

// Preprocessors.
%token preprocessorStart
%token <item>
START
END
%token preprocessorEnd

// Counter reset hints.
%token counterResetHintsStart
%token <item>
UNKNOWN_COUNTER_RESET
COUNTER_RESET
NOT_COUNTER_RESET
GAUGE_TYPE
%token counterResetHintsEnd

// Start symbols for the generated parser.
%token	startSymbolsStart
%token
START_METRIC
START_SERIES_DESCRIPTION
START_EXPRESSION
START_METRIC_SELECTOR
%token	startSymbolsEnd


// Type definitions for grammar rules.
%type <matchers> label_match_list
%type <matcher> label_matcher
%type <item> aggregate_op grouping_label match_op maybe_label metric_identifier unary_op at_modifier_preprocessors string_identifier counter_reset_hint
%type <labels> label_set metric
%type <lblList> label_set_list
%type <label> label_set_item
%type <strings> grouping_label_list grouping_labels maybe_grouping_labels
%type <series> series_item series_values
%type <histogram> histogram_series_value
%type <descriptors> histogram_desc_map histogram_desc_item
%type <bucket_set> bucket_set bucket_set_list
%type <int> int
%type <uint> uint
%type <float> number series_value signed_number signed_or_unsigned_number
%type <node> step_invariant_expr aggregate_expr aggregate_modifier bin_modifier binary_expr bool_modifier expr function_call function_call_args function_call_body group_modifiers label_matchers matrix_selector number_duration_literal offset_expr on_or_ignoring paren_expr string_literal subquery_expr unary_expr vector_selector

%start start

// Operators are listed with increasing precedence.
%left LOR
%left LAND LUNLESS
%left EQLC GTE GTR LSS LTE NEQ
%left ADD SUB
%left MUL DIV MOD ATAN2
%right POW

// Offset modifiers do not have associativity.
%nonassoc OFFSET

// This ensures that it is always attempted to parse range or subquery selectors when a left
// bracket is encountered.
%right LEFT_BRACKET

%%

start           :
                START_METRIC metric
                        { yylex.(*parser).generatedParserResult = $2 }
                | START_SERIES_DESCRIPTION series_description
                | START_EXPRESSION /* empty */ EOF
                        { yylex.(*parser).addParseErrf(posrange.PositionRange{}, "no expression found in input")}
                | START_EXPRESSION expr
                        { yylex.(*parser).generatedParserResult = $2 }
                | START_METRIC_SELECTOR vector_selector
                        { yylex.(*parser).generatedParserResult = $2 }
                | start EOF
                | error /* If none of the more detailed error messages are triggered, we fall back to this. */
                        { yylex.(*parser).unexpected("","") }
                ;

expr            :
                aggregate_expr
                | binary_expr
                | function_call
                | matrix_selector
                | number_duration_literal
                | offset_expr
                | paren_expr
                | string_literal
                | subquery_expr
                | unary_expr
                | vector_selector
                | step_invariant_expr
                ;

/*
 * Aggregations.
 */

aggregate_expr  : aggregate_op aggregate_modifier function_call_body
                        { $$ = yylex.(*parser).newAggregateExpr($1, $2, $3) }
                | aggregate_op function_call_body aggregate_modifier
                        { $$ = yylex.(*parser).newAggregateExpr($1, $3, $2) }
                | aggregate_op function_call_body
                        { $$ = yylex.(*parser).newAggregateExpr($1, &AggregateExpr{}, $2) }
                | aggregate_op error
                        {
                        yylex.(*parser).unexpected("aggregation","");
                        $$ = yylex.(*parser).newAggregateExpr($1, &AggregateExpr{}, Expressions{})
                        }
                ;

aggregate_modifier:
                BY grouping_labels
                        {
                        $$ = &AggregateExpr{
                                Grouping: $2,
                        }
                        }
                | WITHOUT grouping_labels
                        {
                        $$ = &AggregateExpr{
                                Grouping: $2,
                                Without:  true,
                        }
                        }
                ;

/*
 * Binary expressions.
 */

// Operator precedence only works if each of those is listed separately.
binary_expr     : expr ADD     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr ATAN2   bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr DIV     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr EQLC    bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr GTE     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr GTR     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr LAND    bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr LOR     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr LSS     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr LTE     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr LUNLESS bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr MOD     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr MUL     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr NEQ     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr POW     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                | expr SUB     bin_modifier expr { $$ = yylex.(*parser).newBinaryExpression($1, $2, $3, $4) }
                ;

// Using left recursion for the modifier rules, helps to keep the parser stack small and
// reduces allocations.
bin_modifier    : group_modifiers;

bool_modifier   : /* empty */
                        { $$ = &BinaryExpr{
                        VectorMatching: &VectorMatching{Card: CardOneToOne},
                        }
                        }
                | BOOL
                        { $$ = &BinaryExpr{
                        VectorMatching: &VectorMatching{Card: CardOneToOne},
                        ReturnBool:     true,
                        }
                        }
                ;

on_or_ignoring  : bool_modifier IGNORING grouping_labels
                        {
                        $$ = $1
                        $$.(*BinaryExpr).VectorMatching.MatchingLabels = $3
                        }
                | bool_modifier ON grouping_labels
                        {
                        $$ = $1
                        $$.(*BinaryExpr).VectorMatching.MatchingLabels = $3
                        $$.(*BinaryExpr).VectorMatching.On = true
                        }
                ;

group_modifiers: bool_modifier /* empty */
                | on_or_ignoring /* empty */
                | on_or_ignoring GROUP_LEFT maybe_grouping_labels
                        {
                        $$ = $1
                        $$.(*BinaryExpr).VectorMatching.Card = CardManyToOne
                        $$.(*BinaryExpr).VectorMatching.Include = $3
                        }
                | on_or_ignoring GROUP_RIGHT maybe_grouping_labels
                        {
                        $$ = $1
                        $$.(*BinaryExpr).VectorMatching.Card = CardOneToMany
                        $$.(*BinaryExpr).VectorMatching.Include = $3
                        }
                ;


grouping_labels : LEFT_PAREN grouping_label_list RIGHT_PAREN
                        { $$ = $2 }
                | LEFT_PAREN grouping_label_list COMMA RIGHT_PAREN
                        { $$ = $2 }
                | LEFT_PAREN RIGHT_PAREN
                        { $$ = []string{} }
                | error
                        { yylex.(*parser).unexpected("grouping opts", "\"(\""); $$ = nil }
                ;


grouping_label_list:
                grouping_label_list COMMA grouping_label
                        { $$ = append($1, $3.Val) }
                | grouping_label
                        { $$ = []string{$1.Val} }
                | grouping_label_list error
                        { yylex.(*parser).unexpected("grouping opts", "\",\" or \")\""); $$ = $1 }
                ;

grouping_label  : maybe_label
                        {
                        if !model.LabelName($1.Val).IsValid() {
                                yylex.(*parser).addParseErrf($1.PositionRange(),"invalid label name for grouping: %q", $1.Val)
                        }
                        $$ = $1
                        }
                | STRING {
                        unquoted := yylex.(*parser).unquoteString($1.Val)
                        if !model.LabelName(unquoted).IsValid() {
                                yylex.(*parser).addParseErrf($1.PositionRange(),"invalid label name for grouping: %q", unquoted)
                        }
                        $$ = $1
                        $$.Pos++
                        $$.Val = unquoted
                        }
                | error
                        { yylex.(*parser).unexpected("grouping opts", "label"); $$ = Item{} }
                ;

/*
 * Function calls.
 */

function_call   : IDENTIFIER function_call_body
                        {
                        fn, exist := getFunction($1.Val, yylex.(*parser).functions)
                        if !exist{
                                yylex.(*parser).addParseErrf($1.PositionRange(),"unknown function with name %q", $1.Val)
                        }
                        if fn != nil && fn.Experimental && !EnableExperimentalFunctions {
                                yylex.(*parser).addParseErrf($1.PositionRange(),"function %q is not enabled", $1.Val)
                        }
                        $$ = &Call{
                                Func: fn,
                                Args: $2.(Expressions),
                                PosRange: posrange.PositionRange{
                                        Start: $1.Pos,
                                        End:   yylex.(*parser).lastClosing,
                                },
                        }
                        }
                ;

function_call_body: LEFT_PAREN function_call_args RIGHT_PAREN
                        { $$ = $2 }
                | LEFT_PAREN RIGHT_PAREN
                        {$$ = Expressions{}}
                ;

function_call_args: function_call_args COMMA expr
                        { $$ = append($1.(Expressions), $3.(Expr)) }
                | expr
                        { $$ = Expressions{$1.(Expr)} }
                | function_call_args COMMA
                        {
                        yylex.(*parser).addParseErrf($2.PositionRange(), "trailing commas not allowed in function call args")
                        $$ = $1
                        }
                ;

/*
 * Expressions inside parentheses.
 */

paren_expr      : LEFT_PAREN expr RIGHT_PAREN
                        { $$ = &ParenExpr{Expr: $2.(Expr), PosRange: mergeRanges(&$1, &$3)} }
                ;

/*
 * Offset modifiers.
 */

offset_expr: expr OFFSET number_duration_literal
                        {
  		            numLit, _ := $3.(*NumberLiteral)
      		            dur := time.Duration(numLit.Val * 1000) * time.Millisecond
                 	    yylex.(*parser).addOffset($1, dur)
                            $$ = $1
                        }
                | expr OFFSET SUB number_duration_literal
                        {
			    numLit, _ := $4.(*NumberLiteral)
		            dur := time.Duration(numLit.Val * 1000) * time.Millisecond
			    yylex.(*parser).addOffset($1, -dur)
                            $$ = $1
                        }
                | expr OFFSET error
                        { yylex.(*parser).unexpected("offset", "number or duration"); $$ = $1 }
                ;
/*
 * @ modifiers.
 */

step_invariant_expr: expr AT signed_or_unsigned_number
                        {
                        yylex.(*parser).setTimestamp($1, $3)
                        $$ = $1
                        }
                | expr AT at_modifier_preprocessors LEFT_PAREN RIGHT_PAREN
                        {
                        yylex.(*parser).setAtModifierPreprocessor($1, $3)
                        $$ = $1
                        }
                | expr AT error
                        { yylex.(*parser).unexpected("@", "timestamp"); $$ = $1 }
                ;

at_modifier_preprocessors: START | END;

/*
 * Subquery and range selectors.
 */

matrix_selector : expr LEFT_BRACKET number_duration_literal RIGHT_BRACKET
                        {
                        var errMsg string
                        vs, ok := $1.(*VectorSelector)
                        if !ok{
                                errMsg = "ranges only allowed for vector selectors"
                        } else if vs.OriginalOffset != 0{
                                errMsg = "no offset modifiers allowed before range"
                        } else if vs.Timestamp != nil {
                                errMsg = "no @ modifiers allowed before range"
                        }

                        if errMsg != ""{
                                errRange := mergeRanges(&$2, &$4)
                                yylex.(*parser).addParseErrf(errRange, "%s", errMsg)
                        }

			numLit, _ := $3.(*NumberLiteral)
                        $$ = &MatrixSelector{
                                VectorSelector: $1.(Expr),
                                Range: time.Duration(numLit.Val * 1000) * time.Millisecond,
                                EndPos: yylex.(*parser).lastClosing,
                        }
                        }
                ;

subquery_expr   : expr LEFT_BRACKET number_duration_literal COLON number_duration_literal RIGHT_BRACKET
                        {
			numLitRange, _ := $3.(*NumberLiteral)
			numLitStep, _ := $5.(*NumberLiteral)
                        $$ = &SubqueryExpr{
                                Expr:  $1.(Expr),
                                Range: time.Duration(numLitRange.Val * 1000) * time.Millisecond,
                                Step:  time.Duration(numLitStep.Val * 1000) * time.Millisecond,
                                EndPos: $6.Pos + 1,
                        }
                        }
                | expr LEFT_BRACKET number_duration_literal COLON RIGHT_BRACKET
		        {
		          numLitRange, _ := $3.(*NumberLiteral)
		          $$ = &SubqueryExpr{
		          Expr:  $1.(Expr),
		          Range: time.Duration(numLitRange.Val * 1000) * time.Millisecond,
		          Step:  0,
		          EndPos: $5.Pos + 1,
		          }
		        }
                | expr LEFT_BRACKET number_duration_literal COLON number_duration_literal error
                        { yylex.(*parser).unexpected("subquery selector", "\"]\""); $$ = $1 }
                | expr LEFT_BRACKET number_duration_literal COLON error
                        { yylex.(*parser).unexpected("subquery selector", "number or duration or \"]\""); $$ = $1 }
                | expr LEFT_BRACKET number_duration_literal error
                        { yylex.(*parser).unexpected("subquery or range", "\":\" or \"]\""); $$ = $1 }
                | expr LEFT_BRACKET error
		        { yylex.(*parser).unexpected("subquery selector", "number or duration"); $$ = $1 }
                ;

/*
 * Unary expressions.
 */

unary_expr      :
                /* Gives the rule the same precedence as MUL. This aligns with mathematical conventions. */
                unary_op expr %prec MUL
                        {
                        if nl, ok := $2.(*NumberLiteral); ok {
                                if $1.Typ == SUB {
                                        nl.Val *= -1
                                }
                                nl.PosRange.Start = $1.Pos
                                $$ = nl
                        } else {
                                $$ = &UnaryExpr{Op: $1.Typ, Expr: $2.(Expr), StartPos: $1.Pos}
                        }
                        }
                ;

/*
 * Vector selectors.
 */

vector_selector: metric_identifier label_matchers
                        {
                        vs := $2.(*VectorSelector)
                        vs.PosRange = mergeRanges(&$1, vs)
                        vs.Name = $1.Val
                        yylex.(*parser).assembleVectorSelector(vs)
                        $$ = vs
                        }
                | metric_identifier
                        {
                        vs := &VectorSelector{
                                Name: $1.Val,
                                LabelMatchers: []*labels.Matcher{},
                                PosRange: $1.PositionRange(),
                        }
                        yylex.(*parser).assembleVectorSelector(vs)
                        $$ = vs
                        }
                | label_matchers
                        {
                        vs := $1.(*VectorSelector)
                        yylex.(*parser).assembleVectorSelector(vs)
                        $$ = vs
                        }
                ;

label_matchers  : LEFT_BRACE label_match_list RIGHT_BRACE
                        {
                        $$ = &VectorSelector{
                                LabelMatchers: $2,
                                PosRange: mergeRanges(&$1, &$3),
                        }
                        }
                | LEFT_BRACE label_match_list COMMA RIGHT_BRACE
                        {
                        $$ = &VectorSelector{
                                LabelMatchers: $2,
                                PosRange: mergeRanges(&$1, &$4),
                        }
                        }
                | LEFT_BRACE RIGHT_BRACE
                        {
                        $$ = &VectorSelector{
                                LabelMatchers: []*labels.Matcher{},
                                PosRange: mergeRanges(&$1, &$2),
                        }
                        }
                ;

label_match_list: label_match_list COMMA label_matcher
                        {
                        if $1 != nil{
                                $$ = append($1, $3)
                        } else {
                                $$ = $1
                        }
                        }
                | label_matcher
                        { $$ = []*labels.Matcher{$1}}
                | label_match_list error
                        { yylex.(*parser).unexpected("label matching", "\",\" or \"}\""); $$ = $1 }
                ;

label_matcher   : IDENTIFIER match_op STRING
                        { $$ = yylex.(*parser).newLabelMatcher($1, $2, $3); }
                | string_identifier match_op STRING
                        { $$ = yylex.(*parser).newLabelMatcher($1, $2, $3); }
                | string_identifier
                        { $$ = yylex.(*parser).newMetricNameMatcher($1); }
                | string_identifier match_op error
                        { yylex.(*parser).unexpected("label matching", "string"); $$ = nil}
                | IDENTIFIER match_op error
                        { yylex.(*parser).unexpected("label matching", "string"); $$ = nil}
                | IDENTIFIER error
                        { yylex.(*parser).unexpected("label matching", "label matching operator"); $$ = nil }
                | error
                        { yylex.(*parser).unexpected("label matching", "identifier or \"}\""); $$ = nil}
                ;

/*
 * Metric descriptions.
 */

metric          : metric_identifier label_set
                        { b := labels.NewBuilder($2); b.Set(labels.MetricName, $1.Val); $$ = b.Labels() }
                | label_set
                        {$$ = $1}
                ;


metric_identifier: AVG | BOTTOMK | BY | COUNT | COUNT_VALUES | GROUP | IDENTIFIER |  LAND | LOR | LUNLESS | MAX | METRIC_IDENTIFIER | MIN | OFFSET | QUANTILE | STDDEV | STDVAR | SUM | TOPK | WITHOUT | START | END | LIMITK | LIMIT_RATIO;

label_set       : LEFT_BRACE label_set_list RIGHT_BRACE
                        { $$ = labels.New($2...) }
                | LEFT_BRACE label_set_list COMMA RIGHT_BRACE
                        { $$ = labels.New($2...) }
                | LEFT_BRACE RIGHT_BRACE
                        { $$ = labels.New() }
                | /* empty */
                        { $$ = labels.New() }
                ;

label_set_list  : label_set_list COMMA label_set_item
                        { $$ = append($1, $3) }
                | label_set_item
                        { $$ = []labels.Label{$1} }
                | label_set_list error
                        { yylex.(*parser).unexpected("label set", "\",\" or \"}\"", ); $$ = $1 }

                ;

label_set_item  : IDENTIFIER EQL STRING
                        { $$ = labels.Label{Name: $1.Val, Value: yylex.(*parser).unquoteString($3.Val) } }
                | string_identifier EQL STRING
                        { $$ = labels.Label{Name: $1.Val, Value: yylex.(*parser).unquoteString($3.Val) } }
                | string_identifier
                        { $$ = labels.Label{Name: labels.MetricName, Value: $1.Val} }
                | IDENTIFIER EQL error
                        { yylex.(*parser).unexpected("label set", "string"); $$ = labels.Label{}}
                | string_identifier EQL error
                        { yylex.(*parser).unexpected("label set", "string"); $$ = labels.Label{}}
                | IDENTIFIER error
                        { yylex.(*parser).unexpected("label set", "\"=\""); $$ = labels.Label{}}
                | error
                        { yylex.(*parser).unexpected("label set", "identifier or \"}\""); $$ = labels.Label{} }
                ;

/*
 * Series descriptions:
 * A separate language that is used to generate series values promtool.
 * It is included in the promQL parser, because it shares common functionality, such as parsing a metric.
 * The syntax is described in https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/#series
 */

series_description: metric series_values
                        {
                        yylex.(*parser).generatedParserResult = &seriesDescription{
                                labels: $1,
                                values: $2,
                        }
                        }
                ;

series_values   : /*empty*/
                        { $$ = []SequenceValue{} }
                | series_values SPACE series_item
                        { $$ = append($1, $3...) }
                | series_values SPACE
                        { $$ = $1 }
                | error
                        { yylex.(*parser).unexpected("series values", ""); $$ = nil }
                ;

series_item     : BLANK
                        { $$ = []SequenceValue{{Omitted: true}}}
                | BLANK TIMES uint
                        {
                        $$ = []SequenceValue{}
                        for i:=uint64(0); i < $3; i++{
                                $$ = append($$, SequenceValue{Omitted: true})
                        }
                        }
                | series_value
                        { $$ = []SequenceValue{{Value: $1}}}
                | series_value TIMES uint
                        {
                        $$ = []SequenceValue{}
                        // Add an additional value for time 0, which we ignore in tests.
                        for i:=uint64(0); i <= $3; i++{
                                $$ = append($$, SequenceValue{Value: $1})
                        }
                        }
                | series_value signed_number TIMES uint
                        {
                        $$ = []SequenceValue{}
                        // Add an additional value for time 0, which we ignore in tests.
                        for i:=uint64(0); i <= $4; i++{
                                $$ = append($$, SequenceValue{Value: $1})
                                $1 += $2
                        }
                        }
                // Histogram descriptions (part of unit testing).
                | histogram_series_value
                        {
                        $$ = []SequenceValue{{Histogram:$1}}
                        }
                | histogram_series_value TIMES uint
                        {
                        $$ = []SequenceValue{}
                        // Add an additional value for time 0, which we ignore in tests.
                        for i:=uint64(0); i <= $3; i++{
                                $$ = append($$, SequenceValue{Histogram:$1})
                                //$1 += $2
                        }
                        }
                | histogram_series_value ADD histogram_series_value TIMES uint
                        {
                        val, err := yylex.(*parser).histogramsIncreaseSeries($1,$3,$5)
                        if err != nil {
                          yylex.(*parser).addSemanticError(err)
                        }
                        $$ = val
                        }
                | histogram_series_value SUB histogram_series_value TIMES uint
                        {
                        val, err := yylex.(*parser).histogramsDecreaseSeries($1,$3,$5)
                        if err != nil {
                          yylex.(*parser).addSemanticError(err)
                        }
                        $$ = val
                        }
                ;

series_value    : IDENTIFIER
                        {
                        if $1.Val != "stale" {
                                yylex.(*parser).unexpected("series values", "number or \"stale\"")
                        }
                        $$ = math.Float64frombits(value.StaleNaN)
                        }
                | number
                | signed_number
                ;

histogram_series_value
                : OPEN_HIST histogram_desc_map SPACE CLOSE_HIST
                {
                  $$ = yylex.(*parser).buildHistogramFromMap(&$2)
                }
                | OPEN_HIST histogram_desc_map CLOSE_HIST
                {
                  $$ = yylex.(*parser).buildHistogramFromMap(&$2)
                }
                | OPEN_HIST SPACE CLOSE_HIST
                {
                  m := yylex.(*parser).newMap()
                  $$ = yylex.(*parser).buildHistogramFromMap(&m)
                }
                | OPEN_HIST CLOSE_HIST
                {
                  m := yylex.(*parser).newMap()
                  $$ = yylex.(*parser).buildHistogramFromMap(&m)
                }
                ;

histogram_desc_map
                : histogram_desc_map SPACE histogram_desc_item
                {
                  $$ = *(yylex.(*parser).mergeMaps(&$1,&$3))
                }
                | histogram_desc_item
                {
                  $$ = $1
                }
                | histogram_desc_map error {
                  yylex.(*parser).unexpected("histogram description", "histogram description key, e.g. buckets:[5 10 7]")
                }
                ;

histogram_desc_item
                : SCHEMA_DESC COLON int
                {
                   $$ = yylex.(*parser).newMap()
                   $$["schema"] = $3
                }
                | SUM_DESC COLON signed_or_unsigned_number
                {
                   $$ = yylex.(*parser).newMap()
                   $$["sum"] = $3
                }
                | COUNT_DESC COLON signed_or_unsigned_number
                {
                   $$ = yylex.(*parser).newMap()
                   $$["count"] = $3
                }
                | ZERO_BUCKET_DESC COLON signed_or_unsigned_number
                {
                   $$ = yylex.(*parser).newMap()
                   $$["z_bucket"] = $3
                }
                | ZERO_BUCKET_WIDTH_DESC COLON number
                {
                   $$ = yylex.(*parser).newMap()
                   $$["z_bucket_w"] = $3
                }
                | CUSTOM_VALUES_DESC COLON bucket_set
                {
                   $$ = yylex.(*parser).newMap()
                   $$["custom_values"] = $3
                }
                | BUCKETS_DESC COLON bucket_set
                {
                   $$ = yylex.(*parser).newMap()
                   $$["buckets"] = $3
                }
                | OFFSET_DESC COLON int
                {
                   $$ = yylex.(*parser).newMap()
                   $$["offset"] = $3
                }
                | NEGATIVE_BUCKETS_DESC COLON bucket_set
                {
                   $$ = yylex.(*parser).newMap()
                   $$["n_buckets"] = $3
                }
                | NEGATIVE_OFFSET_DESC COLON int
                {
                   $$ = yylex.(*parser).newMap()
                   $$["n_offset"] = $3
                }
                | COUNTER_RESET_HINT_DESC COLON counter_reset_hint
                {
                   $$ = yylex.(*parser).newMap()
                   $$["counter_reset_hint"] = $3
                }
                ;

bucket_set      : LEFT_BRACKET bucket_set_list SPACE RIGHT_BRACKET
                {
                  $$ = $2
                }
                | LEFT_BRACKET bucket_set_list RIGHT_BRACKET
                {
                  $$ = $2
                }
                ;

bucket_set_list : bucket_set_list SPACE signed_or_unsigned_number
                {
                  $$ = append($1, $3)
                }
                | signed_or_unsigned_number
                {
                  $$ = []float64{$1}
                }
                | bucket_set_list error
                ;

counter_reset_hint : UNKNOWN_COUNTER_RESET | COUNTER_RESET | NOT_COUNTER_RESET | GAUGE_TYPE;

/*
 * Keyword lists.
 */

aggregate_op    : AVG | BOTTOMK | COUNT | COUNT_VALUES | GROUP | MAX | MIN | QUANTILE | STDDEV | STDVAR | SUM | TOPK | LIMITK | LIMIT_RATIO;

// Inside of grouping options label names can be recognized as keywords by the lexer. This is a list of keywords that could also be a label name.
maybe_label     : AVG | BOOL | BOTTOMK | BY | COUNT | COUNT_VALUES | GROUP | GROUP_LEFT | GROUP_RIGHT | IDENTIFIER | IGNORING | LAND | LOR | LUNLESS | MAX | METRIC_IDENTIFIER | MIN | OFFSET | ON | QUANTILE | STDDEV | STDVAR | SUM | TOPK | START | END | ATAN2 | LIMITK | LIMIT_RATIO;

unary_op        : ADD | SUB;

match_op        : EQL | NEQ | EQL_REGEX | NEQ_REGEX ;

/*
 * Literals.
 */

number_duration_literal  : NUMBER
                        {
                            $$ = &NumberLiteral{
                                Val:           yylex.(*parser).number($1.Val),
                                PosRange: $1.PositionRange(),
                            }
                        }
                        | DURATION
			{
                            var err error
                            var dur time.Duration
                            dur, err = parseDuration($1.Val)
                            if err != nil {
                                    yylex.(*parser).addParseErr($1.PositionRange(), err)
                            }
                            $$ = &NumberLiteral{
			            Val:      dur.Seconds(),
			            PosRange: $1.PositionRange(),
                            }
                        }
                ;

number          : NUMBER
                {
		  $$ = yylex.(*parser).number($1.Val)
		}
                | DURATION
		{
		  var err error
		  var dur time.Duration
		  dur, err = parseDuration($1.Val)
		  if err != nil {
		      yylex.(*parser).addParseErr($1.PositionRange(), err)
		  }
		  $$ = dur.Seconds()
		}
                ;

signed_number   : ADD number { $$ = $2 }
                | SUB number { $$ = -$2 }
                ;

signed_or_unsigned_number: number | signed_number ;

uint            : NUMBER
                        {
                        var err error
                        $$, err = strconv.ParseUint($1.Val, 10, 64)
                        if err != nil {
                                yylex.(*parser).addParseErrf($1.PositionRange(), "invalid repetition in series values: %s", err)
                        }
                        }
                ;

int             : SUB uint { $$ = -int64($2) }
                | uint { $$ = int64($1) }
                ;

string_literal  : STRING
                        {
                        $$ = &StringLiteral{
                                Val: yylex.(*parser).unquoteString($1.Val),
                                PosRange: $1.PositionRange(),
                        }
                        }
                ;

string_identifier  : STRING
                        {
                        $$ = Item{
                                Typ: METRIC_IDENTIFIER,
                                Pos: $1.PositionRange().Start,
                                Val: yylex.(*parser).unquoteString($1.Val),
                        }
                        }
                ;

/*
 * Wrappers for optional arguments.
 */

maybe_grouping_labels: /* empty */ { $$ = nil }
                | grouping_labels
                ;

%%
