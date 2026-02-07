%{
package traceql

import (
  "time"
)
%}

%start root

%union {
    root RootExpr
    groupOperation GroupOperation
    coalesceOperation CoalesceOperation
    selectOperation SelectOperation
    attributeList []Attribute

    spansetExpression SpansetExpression
    spansetPipelineExpression SpansetExpression
    wrappedSpansetPipeline Pipeline
    spansetPipeline Pipeline
    spansetFilter *SpansetFilter
    scalarFilter ScalarFilter
    scalarFilterOperation Operator

    scalarPipelineExpressionFilter ScalarFilter
    scalarPipelineExpression ScalarExpression
    scalarExpression ScalarExpression
    wrappedScalarPipeline Pipeline
    scalarPipeline Pipeline
    aggregate Aggregate
    metricsAggregation firstStageElement
    metricsSecondStage secondStageElement

    fieldExpression FieldExpression
    static Static
    intrinsicField Attribute
    attributeField Attribute
    attribute Attribute
    scopedIntrinsicField Attribute

    binOp       Operator
    staticInt   int
    staticStr   string
    staticFloat float64
    staticDuration time.Duration
    numericList []float64

    hint *Hint
    hintList []*Hint
    hints *Hints
}

%type <RootExpr> root
%type <groupOperation> groupOperation
%type <coalesceOperation> coalesceOperation
%type <selectOperation> selectOperation
%type <attributeList> attributeList

%type <spansetExpression> spansetExpression
%type <spansetPipelineExpression> spansetPipelineExpression
%type <wrappedSpansetPipeline> wrappedSpansetPipeline
%type <spansetPipeline> spansetPipeline
%type <spansetFilter> spansetFilter
%type <scalarFilter> scalarFilter
%type <scalarFilterOperation> scalarFilterOperation
%type <metricsAggregation> metricsAggregation
%type <metricsSecondStage> metricsSecondStage

%type <scalarPipelineExpressionFilter> scalarPipelineExpressionFilter
%type <scalarPipelineExpression> scalarPipelineExpression
%type <scalarExpression> scalarExpression
%type <wrappedScalarPipeline> wrappedScalarPipeline
%type <scalarPipeline> scalarPipeline
%type <aggregate> aggregate 

%type <fieldExpression> fieldExpression
%type <static> static
%type <intrinsicField> intrinsicField
%type <attributeField> attributeField
%type <scopedIntrinsicField> scopedIntrinsicField
%type <attribute> attribute

%type <numericList> numericList

%type <hint> hint
%type <hintList> hintList
%type <hints> hints

%token <staticStr>      IDENTIFIER STRING
%token <staticInt>      INTEGER
%token <staticFloat>    FLOAT
%token <staticDuration> DURATION
%token <val>            DOT OPEN_BRACE CLOSE_BRACE OPEN_PARENS CLOSE_PARENS COMMA
                        NIL TRUE FALSE STATUS_ERROR STATUS_OK STATUS_UNSET
                        KIND_UNSPECIFIED KIND_INTERNAL KIND_SERVER KIND_CLIENT KIND_PRODUCER KIND_CONSUMER
                        IDURATION CHILDCOUNT NAME STATUS STATUS_MESSAGE PARENT KIND ROOTNAME ROOTSERVICENAME 
                        ROOTSERVICE TRACEDURATION NESTEDSETLEFT NESTEDSETRIGHT NESTEDSETPARENT ID 
                        TRACE_ID SPAN_ID PARENT_ID TIMESINCESTART VERSION
                        PARENT_DOT RESOURCE_DOT SPAN_DOT TRACE_COLON SPAN_COLON 
                        EVENT_COLON EVENT_DOT LINK_COLON LINK_DOT INSTRUMENTATION_COLON INSTRUMENTATION_DOT
                        COUNT AVG MAX MIN SUM
                        BY COALESCE SELECT
                        END_ATTRIBUTE
                        RATE COUNT_OVER_TIME MIN_OVER_TIME MAX_OVER_TIME AVG_OVER_TIME SUM_OVER_TIME QUANTILE_OVER_TIME HISTOGRAM_OVER_TIME COMPARE
                        TOPK BOTTOMK
                        WITH

// Operators are listed with increasing precedence.
%left <binOp> PIPE
%left <binOp> AND OR
%left <binOp> EQ NEQ LT LTE GT GTE NRE RE DESC ANCE SIBL NOT_CHILD NOT_PARENT NOT_DESC NOT_ANCE UNION_CHILD UNION_PARENT UNION_DESC UNION_ANCE UNION_SIBL
%left <binOp> ADD SUB
%left <binOp> NOT
%left <binOp> MUL DIV MOD
%right <binOp> POW
%nonassoc NIL
%%

// **********************
// Pipeline
// **********************
root:
    spansetPipeline                             { yylex.(*lexer).expr = newRootExpr($1) }
  | spansetPipelineExpression                   { yylex.(*lexer).expr = newRootExpr($1) }
  | scalarPipelineExpressionFilter              { yylex.(*lexer).expr = newRootExpr($1) } 
  | spansetPipeline PIPE metricsAggregation     { yylex.(*lexer).expr = newRootExprWithMetrics($1, $3) }
  // note: would only work for single metrics pipeline and not for multiple metrics pipelines before the fucntions
  | spansetPipeline PIPE metricsAggregation PIPE metricsSecondStage  { yylex.(*lexer).expr = newRootExprWithMetricsTwoStage($1, $3, $5) }
  | root hints                                  { yylex.(*lexer).expr.withHints($2) }
  ;

// **********************
// Spanset Expressions
// **********************
spansetPipelineExpression: // shares the same operators as spansetExpression. split out for readability
    OPEN_PARENS spansetPipelineExpression CLOSE_PARENS           { $$ = $2 }
  | spansetPipelineExpression AND   spansetPipelineExpression    { $$ = newSpansetOperation(OpSpansetAnd, $1, $3) }
  | spansetPipelineExpression GT    spansetPipelineExpression    { $$ = newSpansetOperation(OpSpansetChild, $1, $3) }
  | spansetPipelineExpression LT    spansetPipelineExpression    { $$ = newSpansetOperation(OpSpansetParent, $1, $3) }
  | spansetPipelineExpression DESC  spansetPipelineExpression    { $$ = newSpansetOperation(OpSpansetDescendant, $1, $3) }
  | spansetPipelineExpression ANCE  spansetPipelineExpression    { $$ = newSpansetOperation(OpSpansetAncestor, $1, $3) }
  | spansetPipelineExpression OR    spansetPipelineExpression    { $$ = newSpansetOperation(OpSpansetUnion, $1, $3) }
  | spansetPipelineExpression SIBL spansetPipelineExpression     { $$ = newSpansetOperation(OpSpansetSibling, $1, $3) }
  | spansetPipelineExpression NOT_CHILD  spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetNotChild, $1, $3) }
  | spansetPipelineExpression NOT_PARENT spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetNotParent, $1, $3) }
  | spansetPipelineExpression NOT_DESC   spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetNotDescendant, $1, $3) }
  | spansetPipelineExpression NOT_ANCE   spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetNotAncestor, $1, $3) }
  | spansetPipelineExpression NRE        spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetNotSibling, $1, $3) }
  | spansetPipelineExpression UNION_CHILD  spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetUnionChild, $1, $3) }
  | spansetPipelineExpression UNION_PARENT spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetUnionParent, $1, $3) }
  | spansetPipelineExpression UNION_DESC   spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetUnionDescendant, $1, $3) }
  | spansetPipelineExpression UNION_ANCE   spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetUnionAncestor, $1, $3) }
  | spansetPipelineExpression UNION_SIBL   spansetPipelineExpression  { $$ = newSpansetOperation(OpSpansetUnionSibling, $1, $3) }
  | wrappedSpansetPipeline                                       { $$ = $1 }
  ;

wrappedSpansetPipeline:
    OPEN_PARENS spansetPipeline CLOSE_PARENS   { $$ = $2 }

spansetPipeline:
    spansetExpression                          { $$ = newPipeline($1) }
  | scalarFilter                               { $$ = newPipeline($1) }
  | groupOperation                             { $$ = newPipeline($1) }
  | selectOperation                            { $$ = newPipeline($1) }
  | spansetPipeline PIPE spansetExpression     { $$ = $1.addItem($3)  }
  | spansetPipeline PIPE scalarFilter          { $$ = $1.addItem($3)  }
  | spansetPipeline PIPE groupOperation        { $$ = $1.addItem($3)  }
  | spansetPipeline PIPE coalesceOperation     { $$ = $1.addItem($3)  }
  | spansetPipeline PIPE selectOperation       { $$ = $1.addItem($3)  }
  ;

groupOperation:
    BY OPEN_PARENS fieldExpression CLOSE_PARENS { $$ = newGroupOperation($3) }
  ;

coalesceOperation:
    COALESCE OPEN_PARENS CLOSE_PARENS           { $$ = newCoalesceOperation() }
  ;

selectOperation:
    SELECT OPEN_PARENS attributeList CLOSE_PARENS { $$ = newSelectOperation($3) }
  ;

attribute:
  intrinsicField          { $$ = $1 }
  | attributeField        { $$ = $1 }
  | scopedIntrinsicField  { $$ = $1 }
  ;

attributeList:
    attribute                     { $$ = []Attribute{$1} }
  | attributeList COMMA attribute { $$ = append($1, $3) }
  ;

// Comma-separated list of numeric values. Casts all to floats
numericList:
  FLOAT                       { $$ = []float64{$1} }
  | INTEGER                   { $$ = []float64{float64($1)}}
  | numericList COMMA FLOAT   { $$ = append($1, $3) }
  | numericList COMMA INTEGER { $$ = append($1, float64($3))}
  ;

spansetExpression: // shares the same operators as scalarPipelineExpression. split out for readability
    OPEN_PARENS spansetExpression CLOSE_PARENS   { $$ = $2 }
  | spansetExpression AND   spansetExpression    { $$ = newSpansetOperation(OpSpansetAnd, $1, $3) }
  | spansetExpression GT    spansetExpression    { $$ = newSpansetOperation(OpSpansetChild, $1, $3) }
  | spansetExpression LT    spansetExpression    { $$ = newSpansetOperation(OpSpansetParent, $1, $3) }
  | spansetExpression DESC  spansetExpression    { $$ = newSpansetOperation(OpSpansetDescendant, $1, $3) }
  | spansetExpression ANCE  spansetExpression    { $$ = newSpansetOperation(OpSpansetAncestor, $1, $3) }
  | spansetExpression OR    spansetExpression    { $$ = newSpansetOperation(OpSpansetUnion, $1, $3) }
  | spansetExpression SIBL  spansetExpression    { $$ = newSpansetOperation(OpSpansetSibling, $1, $3) }

  | spansetExpression NOT_CHILD  spansetExpression  { $$ = newSpansetOperation(OpSpansetNotChild, $1, $3) }
  | spansetExpression NOT_PARENT spansetExpression  { $$ = newSpansetOperation(OpSpansetNotParent, $1, $3) }
  | spansetExpression NRE        spansetExpression  { $$ = newSpansetOperation(OpSpansetNotSibling, $1, $3) }
  | spansetExpression NOT_ANCE   spansetExpression  { $$ = newSpansetOperation(OpSpansetNotAncestor, $1, $3) }
  | spansetExpression NOT_DESC   spansetExpression  { $$ = newSpansetOperation(OpSpansetNotDescendant, $1, $3) }

  | spansetExpression UNION_CHILD  spansetExpression  { $$ = newSpansetOperation(OpSpansetUnionChild, $1, $3) }
  | spansetExpression UNION_PARENT spansetExpression  { $$ = newSpansetOperation(OpSpansetUnionParent, $1, $3) }
  | spansetExpression UNION_SIBL   spansetExpression  { $$ = newSpansetOperation(OpSpansetUnionSibling, $1, $3) }
  | spansetExpression UNION_ANCE   spansetExpression  { $$ = newSpansetOperation(OpSpansetUnionAncestor, $1, $3) }
  | spansetExpression UNION_DESC   spansetExpression  { $$ = newSpansetOperation(OpSpansetUnionDescendant, $1, $3) }

  | spansetFilter                                { $$ = $1 } 
  ;

spansetFilter:
    OPEN_BRACE CLOSE_BRACE                      { $$ = newSpansetFilter(NewStaticBool(true)) }
  | OPEN_BRACE fieldExpression CLOSE_BRACE      { $$ = newSpansetFilter($2) }
  ;

scalarFilter:
    scalarExpression          scalarFilterOperation scalarExpression          { $$ = newScalarFilter($2, $1, $3) }
  ;

scalarFilterOperation:
    EQ     { $$ = OpEqual        }
  | NEQ    { $$ = OpNotEqual     }
  | LT     { $$ = OpLess         }
  | LTE    { $$ = OpLessEqual    }
  | GT     { $$ = OpGreater      }
  | GTE    { $$ = OpGreaterEqual }
  ;

// **********************
// Scalar Expressions
// **********************
scalarPipelineExpressionFilter:
    scalarPipelineExpression scalarFilterOperation scalarPipelineExpression { $$ = newScalarFilter($2, $1, $3) }
  | scalarPipelineExpression scalarFilterOperation static                   { $$ = newScalarFilter($2, $1, $3) }
  ;

scalarPipelineExpression: // shares the same operators as scalarExpression. split out for readability
    OPEN_PARENS scalarPipelineExpression CLOSE_PARENS        { $$ = $2 }                                   
  | scalarPipelineExpression ADD scalarPipelineExpression    { $$ = newScalarOperation(OpAdd, $1, $3) }
  | scalarPipelineExpression SUB scalarPipelineExpression    { $$ = newScalarOperation(OpSub, $1, $3) }
  | scalarPipelineExpression MUL scalarPipelineExpression    { $$ = newScalarOperation(OpMult, $1, $3) }
  | scalarPipelineExpression DIV scalarPipelineExpression    { $$ = newScalarOperation(OpDiv, $1, $3) }
  | scalarPipelineExpression MOD scalarPipelineExpression    { $$ = newScalarOperation(OpMod, $1, $3) }
  | scalarPipelineExpression POW scalarPipelineExpression    { $$ = newScalarOperation(OpPower, $1, $3) }
  | wrappedScalarPipeline                                    { $$ = $1 }
  ;

wrappedScalarPipeline:
    OPEN_PARENS scalarPipeline CLOSE_PARENS    { $$ = $2 }
  ;

scalarPipeline:
    spansetPipeline PIPE aggregate      { $$ = $1.addItem($3)  }
  ;

scalarExpression: // shares the same operators as scalarPipelineExpression. split out for readability
    OPEN_PARENS scalarExpression CLOSE_PARENS  { $$ = $2 }                                   
  | scalarExpression ADD scalarExpression      { $$ = newScalarOperation(OpAdd, $1, $3) }
  | scalarExpression SUB scalarExpression      { $$ = newScalarOperation(OpSub, $1, $3) }
  | scalarExpression MUL scalarExpression      { $$ = newScalarOperation(OpMult, $1, $3) }
  | scalarExpression DIV scalarExpression      { $$ = newScalarOperation(OpDiv, $1, $3) }
  | scalarExpression MOD scalarExpression      { $$ = newScalarOperation(OpMod, $1, $3) }
  | scalarExpression POW scalarExpression      { $$ = newScalarOperation(OpPower, $1, $3) }
  | aggregate                                  { $$ = $1 }
  | INTEGER                                    { $$ = NewStaticInt($1)              }
  | FLOAT                                      { $$ = NewStaticFloat($1)            }
  | DURATION                                   { $$ = NewStaticDuration($1)         }
  | SUB INTEGER                                { $$ = NewStaticInt(-$2)             }
  | SUB FLOAT                                  { $$ = NewStaticFloat(-$2)           }
  | SUB DURATION                               { $$ = NewStaticDuration(-$2)        }
  ;

aggregate:
    COUNT OPEN_PARENS CLOSE_PARENS                { $$ = newAggregate(aggregateCount, nil) }
  | MAX OPEN_PARENS fieldExpression CLOSE_PARENS  { $$ = newAggregate(aggregateMax, $3) }
  | MIN OPEN_PARENS fieldExpression CLOSE_PARENS  { $$ = newAggregate(aggregateMin, $3) }
  | AVG OPEN_PARENS fieldExpression CLOSE_PARENS  { $$ = newAggregate(aggregateAvg, $3) }
  | SUM OPEN_PARENS fieldExpression CLOSE_PARENS  { $$ = newAggregate(aggregateSum, $3) }
  ;

// **********************
// Metrics
// TODO: rename metricsAggregation -> metricsFirstStage
// **********************
metricsAggregation:
      RATE            OPEN_PARENS CLOSE_PARENS                                                                          { $$ = newMetricsAggregate(metricsAggregateRate, nil) }
    | RATE            OPEN_PARENS CLOSE_PARENS BY OPEN_PARENS attributeList CLOSE_PARENS                                { $$ = newMetricsAggregate(metricsAggregateRate, $6) }
    | COUNT_OVER_TIME OPEN_PARENS CLOSE_PARENS                                                                          { $$ = newMetricsAggregate(metricsAggregateCountOverTime, nil) }
    | COUNT_OVER_TIME OPEN_PARENS CLOSE_PARENS BY OPEN_PARENS attributeList CLOSE_PARENS                                { $$ = newMetricsAggregate(metricsAggregateCountOverTime, $6) }
    | MIN_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS                                                                  { $$ = newMetricsAggregateWithAttr(metricsAggregateMinOverTime, $3, nil) }
    | MIN_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS BY OPEN_PARENS attributeList CLOSE_PARENS                        { $$ = newMetricsAggregateWithAttr(metricsAggregateMinOverTime, $3, $7) }
    | MAX_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS                                                                  { $$ = newMetricsAggregateWithAttr(metricsAggregateMaxOverTime, $3, nil) }
    | MAX_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS BY OPEN_PARENS attributeList CLOSE_PARENS                        { $$ = newMetricsAggregateWithAttr(metricsAggregateMaxOverTime, $3, $7) }
    | SUM_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS                                                                  { $$ = newMetricsAggregateWithAttr(metricsAggregateSumOverTime, $3, nil) }
    | SUM_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS BY OPEN_PARENS attributeList CLOSE_PARENS                        { $$ = newMetricsAggregateWithAttr(metricsAggregateSumOverTime, $3, $7) }
    | AVG_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS                                                                  { $$ = newAverageOverTimeMetricsAggregator($3, nil) }
    | AVG_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS BY OPEN_PARENS attributeList CLOSE_PARENS                        { $$ = newAverageOverTimeMetricsAggregator($3, $7) }
    | QUANTILE_OVER_TIME OPEN_PARENS attribute COMMA numericList CLOSE_PARENS                                           { $$ = newMetricsAggregateQuantileOverTime($3, $5, nil) }
    | QUANTILE_OVER_TIME OPEN_PARENS attribute COMMA numericList CLOSE_PARENS BY OPEN_PARENS attributeList CLOSE_PARENS { $$ = newMetricsAggregateQuantileOverTime($3, $5, $9) }
    | HISTOGRAM_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS                                                            { $$ = newMetricsAggregateWithAttr(metricsAggregateHistogramOverTime, $3, nil) }
    | HISTOGRAM_OVER_TIME OPEN_PARENS attribute CLOSE_PARENS BY OPEN_PARENS attributeList CLOSE_PARENS                  { $$ = newMetricsAggregateWithAttr(metricsAggregateHistogramOverTime, $3, $7) }
    | COMPARE OPEN_PARENS spansetFilter CLOSE_PARENS                                                                    { $$ = newMetricsCompare($3, 10, 0, 0)}
    | COMPARE OPEN_PARENS spansetFilter COMMA INTEGER CLOSE_PARENS                                                      { $$ = newMetricsCompare($3, $5, 0, 0)}
    | COMPARE OPEN_PARENS spansetFilter COMMA INTEGER COMMA INTEGER COMMA INTEGER CLOSE_PARENS                          { $$ = newMetricsCompare($3, $5, $7, $9)}
  ;

// **********************
// Metrics Second Stage Functions
// **********************
metricsSecondStage:
    TOPK OPEN_PARENS INTEGER CLOSE_PARENS                        { $$ = newTopKBottomK(OpTopK, $3) }
    | BOTTOMK OPEN_PARENS INTEGER CLOSE_PARENS                   { $$ = newTopKBottomK(OpBottomK, $3) }
  ;

// **********************
// Hints
// **********************
hint:
    IDENTIFIER EQ static { $$ = newHint($1,$3) }
  ;

hints:
    WITH OPEN_PARENS hintList CLOSE_PARENS { $$ = newHints($3) }
  ;   

hintList:
    hint                { $$ = []*Hint{$1} }
  | hintList COMMA hint { $$ = append($1, $3) }
  ;


// **********************
// FieldExpressions
// **********************
fieldExpression:
    OPEN_PARENS fieldExpression CLOSE_PARENS { $$ = $2 }      
  // Binary operations                             
  | fieldExpression ADD fieldExpression      { $$ = newBinaryOperation(OpAdd, $1, $3) }
  | fieldExpression SUB fieldExpression      { $$ = newBinaryOperation(OpSub, $1, $3) }
  | fieldExpression MUL fieldExpression      { $$ = newBinaryOperation(OpMult, $1, $3) }
  | fieldExpression DIV fieldExpression      { $$ = newBinaryOperation(OpDiv, $1, $3) }
  | fieldExpression MOD fieldExpression      { $$ = newBinaryOperation(OpMod, $1, $3) }
  | fieldExpression EQ fieldExpression       { $$ = newBinaryOperation(OpEqual, $1, $3) }
  | fieldExpression NEQ fieldExpression      { $$ = newBinaryOperation(OpNotEqual, $1, $3) }
  | fieldExpression LT fieldExpression       { $$ = newBinaryOperation(OpLess, $1, $3) }
  | fieldExpression LTE fieldExpression      { $$ = newBinaryOperation(OpLessEqual, $1, $3) }
  | fieldExpression GT fieldExpression       { $$ = newBinaryOperation(OpGreater, $1, $3) }
  | fieldExpression GTE fieldExpression      { $$ = newBinaryOperation(OpGreaterEqual, $1, $3) }
  | fieldExpression RE fieldExpression       { $$ = newBinaryOperation(OpRegex, $1, $3) }
  | fieldExpression NRE fieldExpression      { $$ = newBinaryOperation(OpNotRegex, $1, $3) }
  | fieldExpression POW fieldExpression      { $$ = newBinaryOperation(OpPower, $1, $3) }
  | fieldExpression AND fieldExpression      { $$ = newBinaryOperation(OpAnd, $1, $3) }
  | fieldExpression OR fieldExpression       { $$ = newBinaryOperation(OpOr, $1, $3) }
  // NIL handling
  | fieldExpression NEQ NIL                  { $$ = newUnaryOperation(OpExists, $1) }
  | NIL NEQ fieldExpression                  { $$ = newUnaryOperation(OpExists, $3) }
  | NIL NEQ NIL                              { $$ = NewStaticBool(false) }
  | NIL EQ NIL                               { $$ = NewStaticBool(false) }
  // Unary operations
  | SUB fieldExpression                      { $$ = newUnaryOperation(OpSub, $2) }
  | NOT fieldExpression                      { $$ = newUnaryOperation(OpNot, $2) }
  | static                                   { $$ = $1 }
  | intrinsicField                           { $$ = $1 }
  | attributeField                           { $$ = $1 }
  | scopedIntrinsicField                     { $$ = $1 }
  ;

// **********************
// Statics
// **********************
static:
    STRING           { $$ = NewStaticString($1)           }
  | INTEGER          { $$ = NewStaticInt($1)              }
  | FLOAT            { $$ = NewStaticFloat($1)            }
  | TRUE             { $$ = NewStaticBool(true)           }
  | FALSE            { $$ = NewStaticBool(false)          }
  | DURATION         { $$ = NewStaticDuration($1)         }
  | STATUS_OK        { $$ = NewStaticStatus(StatusOk)     }
  | STATUS_ERROR     { $$ = NewStaticStatus(StatusError)  }
  | STATUS_UNSET     { $$ = NewStaticStatus(StatusUnset)  } 
  | KIND_UNSPECIFIED { $$ = NewStaticKind(KindUnspecified)}
  | KIND_INTERNAL    { $$ = NewStaticKind(KindInternal)   }
  | KIND_SERVER      { $$ = NewStaticKind(KindServer)     }
  | KIND_CLIENT      { $$ = NewStaticKind(KindClient)     }
  | KIND_PRODUCER    { $$ = NewStaticKind(KindProducer)   }
  | KIND_CONSUMER    { $$ = NewStaticKind(KindConsumer)   }
  ;

// ** DO NOT ADD MORE FEATURES **
// Going forward with scoped intrinsics only
intrinsicField:
    IDURATION       { $$ = NewIntrinsic(IntrinsicDuration)         }
  | CHILDCOUNT      { $$ = NewIntrinsic(IntrinsicChildCount)       }
  | NAME            { $$ = NewIntrinsic(IntrinsicName)             }
  | STATUS          { $$ = NewIntrinsic(IntrinsicStatus)           }
  | STATUS_MESSAGE  { $$ = NewIntrinsic(IntrinsicStatusMessage)    }
  | KIND            { $$ = NewIntrinsic(IntrinsicKind)             }
  | PARENT          { $$ = NewIntrinsic(IntrinsicParent)           }
  | ROOTNAME        { $$ = NewIntrinsic(IntrinsicTraceRootSpan)    }
  | ROOTSERVICENAME { $$ = NewIntrinsic(IntrinsicTraceRootService) }
  | TRACEDURATION   { $$ = NewIntrinsic(IntrinsicTraceDuration)    }
  | NESTEDSETLEFT   { $$ = NewIntrinsic(IntrinsicNestedSetLeft)    }
  | NESTEDSETRIGHT  { $$ = NewIntrinsic(IntrinsicNestedSetRight)   }
  | NESTEDSETPARENT { $$ = NewIntrinsic(IntrinsicNestedSetParent)  }
  ;

scopedIntrinsicField:
//  trace:
    TRACE_COLON IDURATION           { $$ = NewIntrinsic(IntrinsicTraceDuration)          }
  | TRACE_COLON ROOTNAME            { $$ = NewIntrinsic(IntrinsicTraceRootSpan)          }
  | TRACE_COLON ROOTSERVICE         { $$ = NewIntrinsic(IntrinsicTraceRootService)       }
  | TRACE_COLON ID                  { $$ = NewIntrinsic(IntrinsicTraceID)                }
//  span:             
  | SPAN_COLON IDURATION            { $$ = NewIntrinsic(IntrinsicDuration)               }
  | SPAN_COLON NAME                 { $$ = NewIntrinsic(IntrinsicName)                   }
  | SPAN_COLON KIND                 { $$ = NewIntrinsic(IntrinsicKind)                   }
  | SPAN_COLON STATUS               { $$ = NewIntrinsic(IntrinsicStatus)                 }
  | SPAN_COLON STATUS_MESSAGE       { $$ = NewIntrinsic(IntrinsicStatusMessage)          }
  | SPAN_COLON ID                   { $$ = NewIntrinsic(IntrinsicSpanID)                 }
  | SPAN_COLON PARENT_ID            { $$ = NewIntrinsic(IntrinsicParentID)               }
// event:             
  | EVENT_COLON NAME                { $$ = NewIntrinsic(IntrinsicEventName)              }
  | EVENT_COLON TIMESINCESTART      { $$ = NewIntrinsic(IntrinsicEventTimeSinceStart)    }
// link:             
  | LINK_COLON TRACE_ID             { $$ = NewIntrinsic(IntrinsicLinkTraceID)            }
  | LINK_COLON SPAN_ID              { $$ = NewIntrinsic(IntrinsicLinkSpanID)             }
// instrumentation:
  | INSTRUMENTATION_COLON NAME      { $$ = NewIntrinsic(IntrinsicInstrumentationName)    }
  | INSTRUMENTATION_COLON VERSION   { $$ = NewIntrinsic(IntrinsicInstrumentationVersion) }
  ;

attributeField:
    DOT IDENTIFIER END_ATTRIBUTE                      { $$ = NewAttribute($2)                                             }
  | RESOURCE_DOT IDENTIFIER END_ATTRIBUTE             { $$ = NewScopedAttribute(AttributeScopeResource, false, $2)        }
  | SPAN_DOT IDENTIFIER END_ATTRIBUTE                 { $$ = NewScopedAttribute(AttributeScopeSpan, false, $2)            }
  | PARENT_DOT IDENTIFIER END_ATTRIBUTE               { $$ = NewScopedAttribute(AttributeScopeNone, true, $2)             }
  | PARENT_DOT RESOURCE_DOT IDENTIFIER END_ATTRIBUTE  { $$ = NewScopedAttribute(AttributeScopeResource, true, $3)         }
  | PARENT_DOT SPAN_DOT IDENTIFIER END_ATTRIBUTE      { $$ = NewScopedAttribute(AttributeScopeSpan, true, $3)             }
  | EVENT_DOT IDENTIFIER END_ATTRIBUTE                { $$ = NewScopedAttribute(AttributeScopeEvent, false, $2)           }
  | LINK_DOT IDENTIFIER END_ATTRIBUTE                 { $$ = NewScopedAttribute(AttributeScopeLink, false, $2)            }
  | INSTRUMENTATION_DOT IDENTIFIER END_ATTRIBUTE      { $$ = NewScopedAttribute(AttributeScopeInstrumentation, false, $2) }
  ;
