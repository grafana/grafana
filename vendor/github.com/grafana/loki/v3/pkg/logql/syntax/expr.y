%{
package syntax

import (
  "time"
  "github.com/prometheus/prometheus/model/labels"
  "github.com/grafana/loki/v3/pkg/logql/log"

)
%}

%union{
  Expr                    Expr
  Filter                  log.LineMatchType
  Grouping                *Grouping
  Labels                  []string
  LogExpr                 LogSelectorExpr
  LogRangeExpr            *LogRange
  Matcher                 *labels.Matcher
  Matchers                []*labels.Matcher
  RangeAggregationExpr    SampleExpr
  RangeOp                 string
  ConvOp                  string
  Selector                []*labels.Matcher
  VectorAggregationExpr   SampleExpr
  VectorExpr              *VectorExpr
  Vector                  string
  MetricExpr              SampleExpr
  VectorOp                string
  FilterOp                string
  BinOpExpr               SampleExpr
  LabelReplaceExpr        SampleExpr
  binOp                   string
  bytes                   uint64
  str                     string
  duration                time.Duration
  LiteralExpr             *LiteralExpr
  BinOpModifier           *BinOpOptions
  BoolModifier            *BinOpOptions
  OnOrIgnoringModifier    *BinOpOptions
  LabelParser             *LabelParserExpr
  LogfmtParser            *LogfmtParserExpr
  LineFilters             *LineFilterExpr
  LineFilter              *LineFilterExpr
  OrFilter                *LineFilterExpr
  ParserFlags             []string
  PipelineExpr            MultiStageExpr
  PipelineStage           StageExpr
  BytesFilter             log.LabelFilterer
  NumberFilter            log.LabelFilterer
  DurationFilter          log.LabelFilterer
  LabelFilter             log.LabelFilterer
  UnitFilter              log.LabelFilterer
  IPLabelFilter           log.LabelFilterer
  LineFormatExpr          *LineFmtExpr
  LabelFormatExpr         *LabelFmtExpr
  LabelFormat             log.LabelFmt
  LabelsFormat            []log.LabelFmt

  LabelExtractionExpression     log.LabelExtractionExpr
  LabelExtractionExpressionList []log.LabelExtractionExpr
  JSONExpressionParser          *JSONExpressionParser
  LogfmtExpressionParser        *LogfmtExpressionParser

  UnwrapExpr              *UnwrapExpr
  DecolorizeExpr          *DecolorizeExpr
  OffsetExpr              *OffsetExpr
  DropLabel               log.DropLabel
  DropLabels              []log.DropLabel
  DropLabelsExpr          *DropLabelsExpr
  KeepLabel               log.KeepLabel
  KeepLabels              []log.KeepLabel
  KeepLabelsExpr          *KeepLabelsExpr
}

%start root

%type <Expr>                  expr
%type <Filter>                filter
%type <Grouping>              grouping
%type <Labels>                labels
%type <LogExpr>               logExpr
%type <MetricExpr>            metricExpr
%type <LogRangeExpr>          logRangeExpr
%type <Matcher>               matcher
%type <Matchers>              matchers
%type <RangeAggregationExpr>  rangeAggregationExpr
%type <RangeOp>               rangeOp
%type <ConvOp>                convOp
%type <Selector>              selector
%type <VectorAggregationExpr> vectorAggregationExpr
%type <VectorOp>              vectorOp
%type <VectorExpr>            vectorExpr
%type <Vector>                vector
%type <FilterOp>              filterOp
%type <BinOpExpr>             binOpExpr
%type <LiteralExpr>           literalExpr
%type <LabelReplaceExpr>      labelReplaceExpr
%type <BinOpModifier>         binOpModifier
%type <BoolModifier>          boolModifier
%type <OnOrIgnoringModifier>  onOrIgnoringModifier
%type <LabelParser>           labelParser
%type <LogfmtParser>          logfmtParser
%type <PipelineExpr>          pipelineExpr
%type <PipelineStage>         pipelineStage
%type <BytesFilter>           bytesFilter
%type <NumberFilter>          numberFilter
%type <DurationFilter>        durationFilter
%type <LabelFilter>           labelFilter
%type <LineFilters>           lineFilters
%type <LineFilter>            lineFilter
%type <OrFilter>              orFilter
%type <ParserFlags>           parserFlags
%type <LineFormatExpr>        lineFormatExpr
%type <DecolorizeExpr>        decolorizeExpr
%type <DropLabelsExpr>        dropLabelsExpr
%type <DropLabels>            dropLabels
%type <DropLabel>             dropLabel
%type <KeepLabelsExpr>        keepLabelsExpr
%type <KeepLabels>            keepLabels
%type <KeepLabel>             keepLabel
%type <LabelFormatExpr>       labelFormatExpr
%type <LabelFormat>           labelFormat
%type <LabelsFormat>          labelsFormat
%type <LabelExtractionExpression>        labelExtractionExpression
%type <LabelExtractionExpressionList>    labelExtractionExpressionList
%type <LogfmtExpressionParser>           logfmtExpressionParser
%type <JSONExpressionParser>             jsonExpressionParser
%type <UnwrapExpr>            unwrapExpr
%type <UnitFilter>            unitFilter
%type <IPLabelFilter>         ipLabelFilter
%type <OffsetExpr>            offsetExpr

%token <bytes> BYTES
%token <str>      IDENTIFIER STRING NUMBER PARSER_FLAG
%token <duration> DURATION RANGE
%token <val>      MATCHERS LABELS EQ RE NRE NPA OPEN_BRACE CLOSE_BRACE OPEN_BRACKET CLOSE_BRACKET COMMA DOT PIPE_MATCH PIPE_EXACT PIPE_PATTERN
                  OPEN_PARENTHESIS CLOSE_PARENTHESIS BY WITHOUT COUNT_OVER_TIME RATE RATE_COUNTER SUM SORT SORT_DESC AVG MAX MIN COUNT STDDEV STDVAR BOTTOMK TOPK
                  BYTES_OVER_TIME BYTES_RATE BOOL JSON REGEXP LOGFMT PIPE LINE_FMT LABEL_FMT UNWRAP AVG_OVER_TIME SUM_OVER_TIME MIN_OVER_TIME
                  MAX_OVER_TIME STDVAR_OVER_TIME STDDEV_OVER_TIME QUANTILE_OVER_TIME BYTES_CONV DURATION_CONV DURATION_SECONDS_CONV
                  FIRST_OVER_TIME LAST_OVER_TIME ABSENT_OVER_TIME VECTOR LABEL_REPLACE UNPACK OFFSET PATTERN IP ON IGNORING GROUP_LEFT GROUP_RIGHT
                  DECOLORIZE DROP KEEP

// Operators are listed with increasing precedence.
%left <binOp> OR
%left <binOp> AND UNLESS
%left <binOp> CMP_EQ NEQ LT LTE GT GTE
%left <binOp> ADD SUB
%left <binOp> MUL DIV MOD
%right <binOp> POW

%%

root: expr { exprlex.(*parser).expr = $1 };

expr:
      logExpr                                      { $$ = $1 }
    | metricExpr                                   { $$ = $1 }
    ;

metricExpr:
      rangeAggregationExpr                          { $$ = $1 }
    | vectorAggregationExpr                         { $$ = $1 }
    | binOpExpr                                     { $$ = $1 }
    | literalExpr                                   { $$ = $1 }
    | labelReplaceExpr                              { $$ = $1 }
    | vectorExpr                                    { $$ = $1 }
    | OPEN_PARENTHESIS metricExpr CLOSE_PARENTHESIS { $$ = $2 }
    ;

logExpr:
      selector                                    { $$ = newMatcherExpr($1)}
    | selector pipelineExpr                       { $$ = newPipelineExpr(newMatcherExpr($1), $2)}
    | OPEN_PARENTHESIS logExpr CLOSE_PARENTHESIS  { $$ = $2 }
    ;

logRangeExpr:
      selector RANGE                                                                        { $$ = newLogRange(newMatcherExpr($1), $2, nil, nil ) }
    | selector RANGE offsetExpr                                                             { $$ = newLogRange(newMatcherExpr($1), $2, nil, $3 ) }
    | OPEN_PARENTHESIS selector CLOSE_PARENTHESIS RANGE                                     { $$ = newLogRange(newMatcherExpr($2), $4, nil, nil ) }
    | OPEN_PARENTHESIS selector CLOSE_PARENTHESIS RANGE offsetExpr                          { $$ = newLogRange(newMatcherExpr($2), $4, nil, $5 ) }
    | selector RANGE unwrapExpr                                                             { $$ = newLogRange(newMatcherExpr($1), $2, $3, nil ) }
    | selector RANGE offsetExpr unwrapExpr                                                  { $$ = newLogRange(newMatcherExpr($1), $2, $4, $3 ) }
    | OPEN_PARENTHESIS selector CLOSE_PARENTHESIS RANGE unwrapExpr                          { $$ = newLogRange(newMatcherExpr($2), $4, $5, nil ) }
    | OPEN_PARENTHESIS selector CLOSE_PARENTHESIS RANGE offsetExpr unwrapExpr               { $$ = newLogRange(newMatcherExpr($2), $4, $6, $5 ) }
    | selector unwrapExpr RANGE                                                             { $$ = newLogRange(newMatcherExpr($1), $3, $2, nil ) }
    | selector unwrapExpr RANGE offsetExpr                                                  { $$ = newLogRange(newMatcherExpr($1), $3, $2, $4 ) }
    | OPEN_PARENTHESIS selector unwrapExpr CLOSE_PARENTHESIS RANGE                          { $$ = newLogRange(newMatcherExpr($2), $5, $3, nil ) }
    | OPEN_PARENTHESIS selector unwrapExpr CLOSE_PARENTHESIS RANGE offsetExpr               { $$ = newLogRange(newMatcherExpr($2), $5, $3, $6 ) }
    | selector pipelineExpr RANGE                                                           { $$ = newLogRange(newPipelineExpr(newMatcherExpr($1), $2), $3, nil, nil ) }
    | selector pipelineExpr RANGE offsetExpr                                                { $$ = newLogRange(newPipelineExpr(newMatcherExpr($1), $2), $3, nil, $4 ) }
    | OPEN_PARENTHESIS selector pipelineExpr CLOSE_PARENTHESIS RANGE                        { $$ = newLogRange(newPipelineExpr(newMatcherExpr($2), $3), $5, nil, nil ) }
    | OPEN_PARENTHESIS selector pipelineExpr CLOSE_PARENTHESIS RANGE offsetExpr             { $$ = newLogRange(newPipelineExpr(newMatcherExpr($2), $3), $5, nil, $6 ) }
    | selector pipelineExpr unwrapExpr RANGE                                                { $$ = newLogRange(newPipelineExpr(newMatcherExpr($1), $2), $4, $3, nil ) }
    | selector pipelineExpr unwrapExpr RANGE offsetExpr                                     { $$ = newLogRange(newPipelineExpr(newMatcherExpr($1), $2), $4, $3, $5 ) }
    | OPEN_PARENTHESIS selector pipelineExpr unwrapExpr CLOSE_PARENTHESIS RANGE             { $$ = newLogRange(newPipelineExpr(newMatcherExpr($2), $3), $6, $4, nil ) }
    | OPEN_PARENTHESIS selector pipelineExpr unwrapExpr CLOSE_PARENTHESIS RANGE offsetExpr  { $$ = newLogRange(newPipelineExpr(newMatcherExpr($2), $3), $6, $4, $7 ) }
    | selector RANGE pipelineExpr                                                           { $$ = newLogRange(newPipelineExpr(newMatcherExpr($1), $3), $2, nil, nil) }
    | selector RANGE offsetExpr pipelineExpr                                                { $$ = newLogRange(newPipelineExpr(newMatcherExpr($1), $4), $2, nil, $3 ) }
    | selector RANGE pipelineExpr unwrapExpr                                                { $$ = newLogRange(newPipelineExpr(newMatcherExpr($1), $3), $2, $4, nil ) }
    | selector RANGE offsetExpr pipelineExpr unwrapExpr                                     { $$ = newLogRange(newPipelineExpr(newMatcherExpr($1), $4), $2, $5, $3 ) }
    | OPEN_PARENTHESIS logRangeExpr CLOSE_PARENTHESIS                                       { $$ = $2 }
    | logRangeExpr error
    ;

unwrapExpr:
    PIPE UNWRAP IDENTIFIER                                                   { $$ = newUnwrapExpr($3, "")}
  | PIPE UNWRAP convOp OPEN_PARENTHESIS IDENTIFIER CLOSE_PARENTHESIS         { $$ = newUnwrapExpr($5, $3)}
  | unwrapExpr PIPE labelFilter                                              { $$ = $1.addPostFilter($3) }
  ;

convOp:
    BYTES_CONV              { $$ = OpConvBytes }
  | DURATION_CONV           { $$ = OpConvDuration }
  | DURATION_SECONDS_CONV   { $$ = OpConvDurationSeconds }
  ;

rangeAggregationExpr:
      rangeOp OPEN_PARENTHESIS logRangeExpr CLOSE_PARENTHESIS                        { $$ = newRangeAggregationExpr($3, $1, nil, nil) }
    | rangeOp OPEN_PARENTHESIS NUMBER COMMA logRangeExpr CLOSE_PARENTHESIS           { $$ = newRangeAggregationExpr($5, $1, nil, &$3) }
    | rangeOp OPEN_PARENTHESIS logRangeExpr CLOSE_PARENTHESIS grouping               { $$ = newRangeAggregationExpr($3, $1, $5, nil) }
    | rangeOp OPEN_PARENTHESIS NUMBER COMMA logRangeExpr CLOSE_PARENTHESIS grouping  { $$ = newRangeAggregationExpr($5, $1, $7, &$3) }
    ;

vectorAggregationExpr:
    // Aggregations with 1 argument.
      vectorOp OPEN_PARENTHESIS metricExpr CLOSE_PARENTHESIS                               { $$ = mustNewVectorAggregationExpr($3, $1, nil, nil) }
    | vectorOp grouping OPEN_PARENTHESIS metricExpr CLOSE_PARENTHESIS                      { $$ = mustNewVectorAggregationExpr($4, $1, $2, nil,) }
    | vectorOp OPEN_PARENTHESIS metricExpr CLOSE_PARENTHESIS grouping                      { $$ = mustNewVectorAggregationExpr($3, $1, $5, nil) }
    // Aggregations with 2 arguments.
    | vectorOp OPEN_PARENTHESIS NUMBER COMMA metricExpr CLOSE_PARENTHESIS                 { $$ = mustNewVectorAggregationExpr($5, $1, nil, &$3) }
    | vectorOp OPEN_PARENTHESIS NUMBER COMMA metricExpr CLOSE_PARENTHESIS grouping        { $$ = mustNewVectorAggregationExpr($5, $1, $7, &$3) }
    | vectorOp grouping OPEN_PARENTHESIS NUMBER COMMA metricExpr CLOSE_PARENTHESIS        { $$ = mustNewVectorAggregationExpr($6, $1, $2, &$4) }
    ;

labelReplaceExpr:
    LABEL_REPLACE OPEN_PARENTHESIS metricExpr COMMA STRING COMMA STRING COMMA STRING COMMA STRING CLOSE_PARENTHESIS
      { $$ = mustNewLabelReplaceExpr($3, $5, $7, $9, $11)}
    ;

filter:
      PIPE_MATCH                       { $$ = log.LineMatchRegexp }
    | PIPE_EXACT                       { $$ = log.LineMatchEqual }
    | PIPE_PATTERN                     { $$ = log.LineMatchPattern }
    | NRE                              { $$ = log.LineMatchNotRegexp }
    | NEQ                              { $$ = log.LineMatchNotEqual }
    | NPA                              { $$ = log.LineMatchNotPattern }
    ;

selector:
      OPEN_BRACE matchers CLOSE_BRACE  { $$ = $2 }
    | OPEN_BRACE matchers error        { $$ = $2 }
    | OPEN_BRACE CLOSE_BRACE     { }
    ;

matchers:
      matcher                          { $$ = []*labels.Matcher{ $1 } }
    | matchers COMMA matcher           { $$ = append($1, $3) }
    ;

matcher:
      IDENTIFIER EQ STRING             { $$ = mustNewMatcher(labels.MatchEqual, $1, $3) }
    | IDENTIFIER NEQ STRING            { $$ = mustNewMatcher(labels.MatchNotEqual, $1, $3) }
    | IDENTIFIER RE STRING             { $$ = mustNewMatcher(labels.MatchRegexp, $1, $3) }
    | IDENTIFIER NRE STRING            { $$ = mustNewMatcher(labels.MatchNotRegexp, $1, $3) }
    ;

pipelineExpr:
      pipelineStage                  { $$ = MultiStageExpr{ $1 } }
    | pipelineExpr pipelineStage     { $$ = append($1, $2)}
    ;

pipelineStage:
   lineFilters                   { $$ = $1 }
  | PIPE logfmtParser            { $$ = $2 }
  | PIPE labelParser             { $$ = $2 }
  | PIPE jsonExpressionParser    { $$ = $2 }
  | PIPE logfmtExpressionParser  { $$ = $2 }
  | PIPE labelFilter             { $$ = &LabelFilterExpr{LabelFilterer: $2 }}
  | PIPE lineFormatExpr          { $$ = $2 }
  | PIPE decolorizeExpr          { $$ = $2 }
  | PIPE labelFormatExpr         { $$ = $2 }
  | PIPE dropLabelsExpr          { $$ = $2 }
  | PIPE keepLabelsExpr          { $$ = $2 }
  ;

filterOp:
  IP { $$ = OpFilterIP }
  ;

orFilter:
    STRING                                              { $$ = newLineFilterExpr(log.LineMatchEqual, "", $1) }
  | filterOp OPEN_PARENTHESIS STRING CLOSE_PARENTHESIS	{ $$ = newLineFilterExpr(log.LineMatchEqual, $1, $3) }
  | STRING OR orFilter                                  { $$ = newOrLineFilter(newLineFilterExpr(log.LineMatchEqual, "", $1), $3) }
  ;

lineFilter:
    filter STRING                                                   { $$ = newLineFilterExpr($1, "", $2) }
  | filter filterOp OPEN_PARENTHESIS STRING CLOSE_PARENTHESIS       { $$ = newLineFilterExpr($1, $2, $4) }
  | filter STRING OR orFilter                                       { $$ = newOrLineFilter(newLineFilterExpr($1, "", $2), $4) }
  ;

lineFilters:
    lineFilter                { $$ = $1 }
  | lineFilter OR orFilter    { $$ = newOrLineFilter($1, $3)}
  | lineFilters lineFilter    { $$ = newNestedLineFilterExpr($1, $2) }
  ;

parserFlags:
    PARSER_FLAG               { $$ = []string{ $1 } }
  | parserFlags PARSER_FLAG   { $$ = append($1, $2) }
  ;

logfmtParser:
    LOGFMT                   { $$ = newLogfmtParserExpr(nil) }
  | LOGFMT parserFlags       { $$ = newLogfmtParserExpr($2) }
  ;

labelParser:
    JSON                { $$ = newLabelParserExpr(OpParserTypeJSON, "") }
  | REGEXP STRING       { $$ = newLabelParserExpr(OpParserTypeRegexp, $2) }
  | UNPACK              { $$ = newLabelParserExpr(OpParserTypeUnpack, "") }
  | PATTERN STRING      { $$ = newLabelParserExpr(OpParserTypePattern, $2) }
  ;

jsonExpressionParser:
    JSON labelExtractionExpressionList { $$ = newJSONExpressionParser($2) }

logfmtExpressionParser:
    LOGFMT parserFlags labelExtractionExpressionList  { $$ = newLogfmtExpressionParser($3, $2)}
  | LOGFMT labelExtractionExpressionList              { $$ = newLogfmtExpressionParser($2, nil)}
  ;

lineFormatExpr: LINE_FMT STRING { $$ = newLineFmtExpr($2) };

decolorizeExpr: DECOLORIZE { $$ = newDecolorizeExpr() };

labelFormat:
     IDENTIFIER EQ IDENTIFIER { $$ = log.NewRenameLabelFmt($1, $3)}
  |  IDENTIFIER EQ STRING     { $$ = log.NewTemplateLabelFmt($1, $3)}
  ;

labelsFormat:
    labelFormat                    { $$ = []log.LabelFmt{ $1 } }
  | labelsFormat COMMA labelFormat { $$ = append($1, $3) }
  | labelsFormat COMMA error
  ;

labelFormatExpr:
      LABEL_FMT labelsFormat { $$ = newLabelFmtExpr($2) };

labelFilter:
      matcher                                        { $$ = log.NewStringLabelFilter($1) }
    | ipLabelFilter                                  { $$ = $1 }
    | unitFilter                                     { $$ = $1 }
    | numberFilter                                   { $$ = $1 }
    | OPEN_PARENTHESIS labelFilter CLOSE_PARENTHESIS { $$ = $2 }
    | labelFilter labelFilter                        { $$ = log.NewAndLabelFilter($1, $2 ) }
    | labelFilter AND labelFilter                    { $$ = log.NewAndLabelFilter($1, $3 ) }
    | labelFilter COMMA labelFilter                  { $$ = log.NewAndLabelFilter($1, $3 ) }
    | labelFilter OR labelFilter                     { $$ = log.NewOrLabelFilter($1, $3 ) }
    ;

labelExtractionExpression:
    IDENTIFIER EQ STRING { $$ = log.NewLabelExtractionExpr($1, $3) }
  | IDENTIFIER           { $$ = log.NewLabelExtractionExpr($1, $1) }

labelExtractionExpressionList:
    labelExtractionExpression                                     { $$ = []log.LabelExtractionExpr{$1} }
  | labelExtractionExpressionList COMMA labelExtractionExpression { $$ = append($1, $3) }
  ;

ipLabelFilter:
    IDENTIFIER EQ IP OPEN_PARENTHESIS STRING CLOSE_PARENTHESIS { $$ = log.NewIPLabelFilter($5, $1,log.LabelFilterEqual) }
  | IDENTIFIER NEQ IP OPEN_PARENTHESIS STRING CLOSE_PARENTHESIS { $$ = log.NewIPLabelFilter($5, $1, log.LabelFilterNotEqual) }
  ;

unitFilter:
      durationFilter { $$ = $1 }
    | bytesFilter    { $$ = $1 }

durationFilter:
      IDENTIFIER GT DURATION      { $$ = log.NewDurationLabelFilter(log.LabelFilterGreaterThan, $1, $3) }
    | IDENTIFIER GTE DURATION     { $$ = log.NewDurationLabelFilter(log.LabelFilterGreaterThanOrEqual, $1, $3) }
    | IDENTIFIER LT DURATION      { $$ = log.NewDurationLabelFilter(log.LabelFilterLesserThan, $1, $3) }
    | IDENTIFIER LTE DURATION     { $$ = log.NewDurationLabelFilter(log.LabelFilterLesserThanOrEqual, $1, $3) }
    | IDENTIFIER NEQ DURATION     { $$ = log.NewDurationLabelFilter(log.LabelFilterNotEqual, $1, $3) }
    | IDENTIFIER EQ DURATION      { $$ = log.NewDurationLabelFilter(log.LabelFilterEqual, $1, $3) }
    | IDENTIFIER CMP_EQ DURATION  { $$ = log.NewDurationLabelFilter(log.LabelFilterEqual, $1, $3) }
    ;

bytesFilter:
      IDENTIFIER GT BYTES     { $$ = log.NewBytesLabelFilter(log.LabelFilterGreaterThan, $1, $3) }
    | IDENTIFIER GTE BYTES    { $$ = log.NewBytesLabelFilter(log.LabelFilterGreaterThanOrEqual, $1, $3) }
    | IDENTIFIER LT BYTES     { $$ = log.NewBytesLabelFilter(log.LabelFilterLesserThan, $1, $3) }
    | IDENTIFIER LTE BYTES    { $$ = log.NewBytesLabelFilter(log.LabelFilterLesserThanOrEqual, $1, $3) }
    | IDENTIFIER NEQ BYTES    { $$ = log.NewBytesLabelFilter(log.LabelFilterNotEqual, $1, $3) }
    | IDENTIFIER EQ BYTES     { $$ = log.NewBytesLabelFilter(log.LabelFilterEqual, $1, $3) }
    | IDENTIFIER CMP_EQ BYTES { $$ = log.NewBytesLabelFilter(log.LabelFilterEqual, $1, $3) }
    ;

numberFilter:
      IDENTIFIER GT literalExpr      { $$ = log.NewNumericLabelFilter(log.LabelFilterGreaterThan, $1,  $3.Val)}
    | IDENTIFIER GTE literalExpr     { $$ = log.NewNumericLabelFilter(log.LabelFilterGreaterThanOrEqual, $1,$3.Val)}
    | IDENTIFIER LT literalExpr      { $$ = log.NewNumericLabelFilter(log.LabelFilterLesserThan, $1, $3.Val)}
    | IDENTIFIER LTE literalExpr     { $$ = log.NewNumericLabelFilter(log.LabelFilterLesserThanOrEqual, $1, $3.Val)}
    | IDENTIFIER NEQ literalExpr     { $$ = log.NewNumericLabelFilter(log.LabelFilterNotEqual, $1, $3.Val)}
    | IDENTIFIER EQ literalExpr      { $$ = log.NewNumericLabelFilter(log.LabelFilterEqual, $1, $3.Val)}
    | IDENTIFIER CMP_EQ literalExpr  { $$ = log.NewNumericLabelFilter(log.LabelFilterEqual, $1, $3.Val)}
    ;

dropLabel:
      IDENTIFIER { $$ = log.NewDropLabel(nil, $1) }
    | matcher { $$ = log.NewDropLabel($1, "") }

dropLabels:
      dropLabel                  { $$ = []log.DropLabel{$1}}
    | dropLabels COMMA dropLabel { $$ = append($1, $3) }
    ;

dropLabelsExpr: DROP dropLabels { $$ = newDropLabelsExpr($2) }

keepLabel:
      IDENTIFIER { $$ = log.NewKeepLabel(nil, $1) }
    | matcher { $$ = log.NewKeepLabel($1, "") }

keepLabels:
      keepLabel                  { $$ = []log.KeepLabel{$1}}
    | keepLabels COMMA keepLabel { $$ = append($1, $3) }
    ;

keepLabelsExpr: KEEP keepLabels { $$ = newKeepLabelsExpr($2) }

// Operator precedence only works if each of these is listed separately.
binOpExpr:
         expr OR binOpModifier expr          { $$ = mustNewBinOpExpr("or", $3, $1, $4) }
         | expr AND binOpModifier expr       { $$ = mustNewBinOpExpr("and", $3, $1, $4) }
         | expr UNLESS binOpModifier expr    { $$ = mustNewBinOpExpr("unless", $3, $1, $4) }
         | expr ADD binOpModifier expr       { $$ = mustNewBinOpExpr("+", $3, $1, $4) }
         | expr SUB binOpModifier expr       { $$ = mustNewBinOpExpr("-", $3, $1, $4) }
         | expr MUL binOpModifier expr       { $$ = mustNewBinOpExpr("*", $3, $1, $4) }
         | expr DIV binOpModifier expr       { $$ = mustNewBinOpExpr("/", $3, $1, $4) }
         | expr MOD binOpModifier expr       { $$ = mustNewBinOpExpr("%", $3, $1, $4) }
         | expr POW binOpModifier expr       { $$ = mustNewBinOpExpr("^", $3, $1, $4) }
         | expr CMP_EQ binOpModifier expr    { $$ = mustNewBinOpExpr("==", $3, $1, $4) }
         | expr NEQ binOpModifier expr       { $$ = mustNewBinOpExpr("!=", $3, $1, $4) }
         | expr GT binOpModifier expr        { $$ = mustNewBinOpExpr(">", $3, $1, $4) }
         | expr GTE binOpModifier expr       { $$ = mustNewBinOpExpr(">=", $3, $1, $4) }
         | expr LT binOpModifier expr        { $$ = mustNewBinOpExpr("<", $3, $1, $4) }
         | expr LTE binOpModifier expr       { $$ = mustNewBinOpExpr("<=", $3, $1, $4) }
         ;

boolModifier:
		{
		 $$ = &BinOpOptions{VectorMatching: &VectorMatching{Card: CardOneToOne}}
        	}
        | BOOL
        	{
        	 $$ = &BinOpOptions{VectorMatching: &VectorMatching{Card: CardOneToOne}, ReturnBool:true}
        	}
        ;

onOrIgnoringModifier:
    	boolModifier ON OPEN_PARENTHESIS labels CLOSE_PARENTHESIS
		{
		$$ = $1
    		$$.VectorMatching.On=true
    		$$.VectorMatching.MatchingLabels=$4
		}
	| boolModifier ON OPEN_PARENTHESIS CLOSE_PARENTHESIS
		{
		$$ = $1
		$$.VectorMatching.On=true
		}
	| boolModifier IGNORING OPEN_PARENTHESIS labels CLOSE_PARENTHESIS
		{
		$$ = $1
    		$$.VectorMatching.MatchingLabels=$4
		}
	| boolModifier IGNORING OPEN_PARENTHESIS CLOSE_PARENTHESIS
		{
		$$ = $1
		}
	;

binOpModifier:
	boolModifier {$$ = $1 }
 	| onOrIgnoringModifier {$$ = $1 }
 	| onOrIgnoringModifier GROUP_LEFT
                	{
                        $$ = $1
                        $$.VectorMatching.Card = CardManyToOne
                        }
 	| onOrIgnoringModifier GROUP_LEFT OPEN_PARENTHESIS CLOSE_PARENTHESIS
        	{
                $$ = $1
                $$.VectorMatching.Card = CardManyToOne
                }
 	| onOrIgnoringModifier GROUP_LEFT OPEN_PARENTHESIS labels CLOSE_PARENTHESIS
                {
                $$ = $1
                $$.VectorMatching.Card = CardManyToOne
                $$.VectorMatching.Include = $4
                }
        | onOrIgnoringModifier GROUP_RIGHT
        	{
                $$ = $1
                $$.VectorMatching.Card = CardOneToMany
                }
 	| onOrIgnoringModifier GROUP_RIGHT OPEN_PARENTHESIS CLOSE_PARENTHESIS
                {
                $$ = $1
                $$.VectorMatching.Card = CardOneToMany
                }
 	| onOrIgnoringModifier GROUP_RIGHT OPEN_PARENTHESIS labels CLOSE_PARENTHESIS
                {
                $$ = $1
                $$.VectorMatching.Card = CardOneToMany
                $$.VectorMatching.Include = $4
                }
        ;

literalExpr:
           NUMBER         { $$ = mustNewLiteralExpr( $1, false ) }
           | ADD NUMBER   { $$ = mustNewLiteralExpr( $2, false ) }
           | SUB NUMBER   { $$ = mustNewLiteralExpr( $2, true ) }
           ;

vectorExpr:
    vector OPEN_PARENTHESIS NUMBER CLOSE_PARENTHESIS       { $$ = NewVectorExpr( $3 )  }
    ;
vector:
    VECTOR  { $$ = OpTypeVector }
    ;

vectorOp:
        SUM     { $$ = OpTypeSum }
      | AVG     { $$ = OpTypeAvg }
      | COUNT   { $$ = OpTypeCount }
      | MAX     { $$ = OpTypeMax }
      | MIN     { $$ = OpTypeMin }
      | STDDEV  { $$ = OpTypeStddev }
      | STDVAR  { $$ = OpTypeStdvar }
      | BOTTOMK { $$ = OpTypeBottomK }
      | TOPK    { $$ = OpTypeTopK }
      | SORT    { $$ = OpTypeSort }
      | SORT_DESC    { $$ = OpTypeSortDesc }
      ;

rangeOp:
      COUNT_OVER_TIME    { $$ = OpRangeTypeCount }
    | RATE               { $$ = OpRangeTypeRate }
    | RATE_COUNTER       { $$ = OpRangeTypeRateCounter }
    | BYTES_OVER_TIME    { $$ = OpRangeTypeBytes }
    | BYTES_RATE         { $$ = OpRangeTypeBytesRate }
    | AVG_OVER_TIME      { $$ = OpRangeTypeAvg }
    | SUM_OVER_TIME      { $$ = OpRangeTypeSum }
    | MIN_OVER_TIME      { $$ = OpRangeTypeMin }
    | MAX_OVER_TIME      { $$ = OpRangeTypeMax }
    | STDVAR_OVER_TIME   { $$ = OpRangeTypeStdvar }
    | STDDEV_OVER_TIME   { $$ = OpRangeTypeStddev }
    | QUANTILE_OVER_TIME { $$ = OpRangeTypeQuantile }
    | FIRST_OVER_TIME    { $$ = OpRangeTypeFirst }
    | LAST_OVER_TIME     { $$ = OpRangeTypeLast }
    | ABSENT_OVER_TIME   { $$ = OpRangeTypeAbsent }
    ;

offsetExpr:
    OFFSET DURATION { $$ = newOffsetExpr( $2 ) }

labels:
      IDENTIFIER                 { $$ = []string{ $1 } }
    | labels COMMA IDENTIFIER    { $$ = append($1, $3) }
    ;

grouping:
      BY OPEN_PARENTHESIS labels CLOSE_PARENTHESIS        { $$ = &Grouping{ Without: false , Groups: $3 } }
    | WITHOUT OPEN_PARENTHESIS labels CLOSE_PARENTHESIS   { $$ = &Grouping{ Without: true , Groups: $3 } }
    | BY OPEN_PARENTHESIS CLOSE_PARENTHESIS               { $$ = &Grouping{ Without: false , Groups: nil } }
    | WITHOUT OPEN_PARENTHESIS CLOSE_PARENTHESIS          { $$ = &Grouping{ Without: true , Groups: nil } }
    ;
%%
