%{
package parser

import (
	"strconv"
	"strings"

	"github.com/mithrandie/csvq/lib/value"
)
%}

%union{
    program     []Statement
    statement   Statement
    queryexpr   QueryExpression
    queryexprs  []QueryExpression
    expression  Expression
    expressions []Expression
    identifier  Identifier
    table       Table
    variable    Variable
    variables   []Variable
    varassign   VariableAssignment
    varassigns  []VariableAssignment
    envvar      EnvironmentVariable
    flag        Flag
    updateset   UpdateSet
    updatesets  []UpdateSet
    columndef   ColumnDefault
    columndefs  []ColumnDefault
    elseif      []ElseIf
    elseexpr    Else
    casewhen    []CaseWhen
    caseelse    CaseElse
    fetchpos    FetchPosition
    replaceval  ReplaceValue
    replacevals []ReplaceValue
    token       Token
    bool        bool
}

%type<program>     program
%type<program>     loop_program
%type<program>     function_program
%type<program>     function_loop_program
%type<statement>   common_statement
%type<statement>   common_loop_flow_control_statement
%type<statement>   procedure_statement
%type<statement>   while_statement
%type<token>       while_variable_declaration
%type<statement>   exit_statement
%type<statement>   flow_control_statement
%type<statement>   loop_statement
%type<statement>   loop_flow_control_statement
%type<statement>   function_statement
%type<statement>   function_while_statement
%type<statement>   function_exit_statement
%type<statement>   function_loop_statement
%type<statement>   function_flow_control_statement
%type<statement>   function_loop_flow_control_statement
%type<statement>   variable_statement
%type<statement>   environment_variable_statement
%type<statement>   transaction_statement
%type<statement>   table_operation_statement
%type<columndef>   column_default
%type<columndefs>  column_defaults
%type<expression>  column_position
%type<statement>   cursor_statement
%type<statement>   temporary_table_statement
%type<replaceval>  replace_value
%type<replacevals> replace_values
%type<statement>   prepared_statement
%type<varassign>   parameter
%type<varassigns>  parameters
%type<varassign>   optional_parameter
%type<varassigns>  optional_parameters
%type<varassigns>  function_parameters
%type<statement>   user_defined_function_statement
%type<fetchpos>    fetch_position
%type<queryexpr>   cursor_status
%type<statement>   command_statement
%type<statement>   trigger_statement
%type<queryexpr>   select_query
%type<queryexpr>   select_into_query
%type<queryexpr>   select_entity
%type<queryexpr>   select_set_entity
%type<queryexpr>   select_clause
%type<queryexpr>   into_clause
%type<queryexpr>   from_clause
%type<queryexpr>   where_clause
%type<queryexpr>   group_by_clause
%type<queryexpr>   having_clause
%type<queryexpr>   order_by_clause
%type<queryexpr>   limit_clause
%type<token>       limit_restriction
%type<token>       limit_fetch_position
%type<token>       limit_unit
%type<token>       limit_fetch_unit
%type<token>       offset_unit
%type<queryexpr>   offset_clause
%type<queryexpr>   with_clause
%type<queryexpr>   inline_table
%type<queryexprs>  inline_tables
%type<queryexpr>   primitive_type
%type<queryexpr>   ternary
%type<queryexpr>   null
%type<queryexpr>   field_reference
%type<queryexpr>   value
%type<queryexpr>   substantial_value
%type<queryexpr>   wildcard
%type<queryexpr>   row_value
%type<queryexprs>  row_values
%type<queryexprs>  order_items
%type<queryexpr>   order_item
%type<token>       order_direction
%type<token>       order_null_position
%type<queryexpr>   subquery
%type<queryexpr>   string_operation
%type<queryexpr>   matrix_value
%type<queryexpr>   comparison
%type<queryexpr>   arithmetic
%type<queryexpr>   logic
%type<queryexprs>  arguments
%type<queryexpr>   function
%type<queryexpr>   aggregate_function
%type<queryexpr>   list_function
%type<queryexpr>   analytic_function
%type<queryexpr>   analytic_clause
%type<queryexpr>   analytic_clause_with_windowing
%type<queryexpr>   partition_clause
%type<queryexpr>   windowing_clause
%type<queryexpr>   window_position
%type<queryexpr>   window_relative_position
%type<queryexpr>   window_frame_low
%type<queryexpr>   window_frame_high
%type<queryexpr>   table_identifier
%type<token>       table_format
%type<queryexpr>   format_specified_function
%type<token>       inline_table_format
%type<queryexpr>   inline_format_specified_function
%type<queryexpr>   updatable_table_identifier
%type<queryexprs>  identified_tables
%type<queryexprs>  updatable_tables
%type<queryexpr>   table_object
%type<table>       laterable_query_table
%type<queryexprs>  joinable_tables
%type<queryexpr>   table
%type<queryexpr>   join
%type<queryexpr>   join_condition
%type<queryexpr>   field
%type<queryexpr>   case_expr
%type<queryexpr>   case_value
%type<queryexprs>  case_expr_when
%type<queryexpr>   case_expr_else
%type<queryexprs>  field_references
%type<queryexprs>  values
%type<queryexprs>  substantial_values
%type<queryexprs>  tables
%type<queryexprs>  identifiers
%type<queryexprs>  fields
%type<expression>  insert_query
%type<expression>  update_query
%type<updateset>   update_set
%type<updatesets>  update_set_list
%type<expression>  replace_query
%type<expression>  delete_query
%type<elseif>      elseif
%type<elseexpr>    else
%type<elseif>      in_loop_elseif
%type<elseexpr>    in_loop_else
%type<elseif>      in_function_elseif
%type<elseexpr>    in_function_else
%type<elseif>      in_function_in_loop_elseif
%type<elseexpr>    in_function_in_loop_else
%type<casewhen>    case_when
%type<caseelse>    case_else
%type<casewhen>    in_loop_case_when
%type<caseelse>    in_loop_case_else
%type<casewhen>    in_function_case_when
%type<caseelse>    in_function_case_else
%type<casewhen>    in_function_in_loop_case_when
%type<caseelse>    in_function_in_loop_case_else
%type<identifier>  identifier
%type<variable>    variable
%type<variables>   variables
%type<queryexpr>   variable_substitution
%type<varassign>   variable_assignment
%type<varassigns>  variable_assignments
%type<envvar>      environment_variable
%type<queryexpr>   runtime_information
%type<queryexpr>   constant
%type<flag>        flag
%type<token>       distinct
%type<token>       negation
%type<token>       join_type_inner
%type<token>       join_type_outer
%type<token>       join_outer_direction
%type<token>       all
%type<token>       recursive
%type<token>       as
%type<token>       comparison_operator
%type<bool>        if_not_exists

%token<token> IDENTIFIER STRING INTEGER FLOAT BOOLEAN TERNARY DATETIME
%token<token> VARIABLE FLAG ENVIRONMENT_VARIABLE RUNTIME_INFORMATION EXTERNAL_COMMAND PLACEHOLDER
%token<token> CONSTANT TABLE_FUNCTION URL
%token<token> SELECT FROM UPDATE SET UNSET DELETE WHERE INSERT INTO VALUES REPLACE AS DUAL STDIN
%token<token> RECURSIVE
%token<token> CREATE ADD DROP ALTER TABLE FIRST LAST AFTER BEFORE DEFAULT RENAME TO VIEW
%token<token> ORDER GROUP HAVING BY ASC DESC LIMIT OFFSET PERCENT
%token<token> JOIN INNER OUTER LEFT RIGHT FULL CROSS ON USING NATURAL LATERAL
%token<token> UNION INTERSECT EXCEPT
%token<token> ALL ANY EXISTS IN
%token<token> AND OR NOT BETWEEN LIKE IS NULL
%token<token> DISTINCT WITH
%token<token> RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW
%token<token> CASE IF ELSEIF WHILE WHEN THEN ELSE DO END
%token<token> DECLARE CURSOR FOR FETCH OPEN CLOSE DISPOSE PREPARE
%token<token> NEXT PRIOR ABSOLUTE RELATIVE
%token<token> SEPARATOR PARTITION OVER
%token<token> COMMIT ROLLBACK
%token<token> CONTINUE BREAK EXIT
%token<token> ECHO PRINT PRINTF SOURCE EXECUTE CHDIR PWD RELOAD REMOVE SYNTAX TRIGGER
%token<token> FUNCTION AGGREGATE BEGIN RETURN
%token<token> IGNORE WITHIN
%token<token> VAR SHOW
%token<token> TIES NULLS ROWS ONLY
%token<token> CSV JSON JSONL FIXED LTSV
%token<token> CSV_INLINE JSON_INLINE JSON_TABLE
%token<token> JSON_ROW
%token<token> SUBSTRING COUNT JSON_OBJECT
%token<token> AGGREGATE_FUNCTION LIST_FUNCTION ANALYTIC_FUNCTION FUNCTION_NTH FUNCTION_WITH_INS
%token<token> COMPARISON_OP STRING_OP SUBSTITUTION_OP
%token<token> UMINUS UPLUS
%token<token> ';' '=' '-' '+' '*' '/' '%' '!' '(' ')'

%right SUBSTITUTION_OP
%left UNION EXCEPT
%left INTERSECT
%left CROSS FULL NATURAL JOIN
%left OR
%left AND
%right NOT
%nonassoc '=' COMPARISON_OP IS BETWEEN IN LIKE
%left STRING_OP
%left '+' '-'
%left '*' '/' '%'
%right UMINUS UPLUS '!'

%%

program
    :
    {
        $$ = nil
        yylex.(*Lexer).program = $$
    }
    | procedure_statement
    {
        $$ = []Statement{$1}
        yylex.(*Lexer).program = $$
    }
    | procedure_statement ';' program
    {
        $$ = append([]Statement{$1}, $3...)
        yylex.(*Lexer).program = $$
    }

loop_program
    :
    {
        $$ = nil
    }
    | loop_statement ';' loop_program
    {
        $$ = append([]Statement{$1}, $3...)
    }

function_program
    :
    {
        $$ = nil
    }
    | function_statement ';' function_program
    {
        $$ = append([]Statement{$1}, $3...)
    }

function_loop_program
    :
    {
        $$ = nil
    }
    | function_loop_statement ';' function_loop_program
    {
        $$ = append([]Statement{$1}, $3...)
    }

common_statement
    : select_query
    {
        $$ = $1
    }
    | select_into_query
    {
        $$ = $1
    }
    | insert_query
    {
        $$ = $1
    }
    | update_query
    {
        $$ = $1
    }
    | replace_query
    {
        $$ = $1
    }
    | delete_query
    {
        $$ = $1
    }
    | table_operation_statement
    {
        $$ = $1
    }
    | variable_statement
    {
        $$ = $1
    }
    | environment_variable_statement
    {
        $$ = $1
    }
    | cursor_statement
    {
        $$ = $1
    }
    | temporary_table_statement
    {
        $$ = $1
    }
    | prepared_statement
    {
        $$ = $1
    }
    | user_defined_function_statement
    {
        $$ = $1
    }
    | transaction_statement
    {
        $$ = $1
    }
    | command_statement
    {
        $$ = $1
    }
    | trigger_statement
    {
        $$ = $1
    }
    | substantial_value
    {
        $$ = $1
    }
    | EXTERNAL_COMMAND
    {
        $$ = ExternalCommand{BaseExpr: NewBaseExpr($1), Command: $1.Literal}
    }

common_loop_flow_control_statement
    : CONTINUE
    {
        $$ = FlowControl{Token: $1.Token}
    }
    | BREAK
    {
        $$ = FlowControl{Token: $1.Token}
    }

procedure_statement
    : common_statement
    {
        $$ = $1
    }
    | flow_control_statement
    {
        $$ = $1
    }

while_statement
    : WHILE substantial_value DO loop_program END WHILE
    {
        $$ = While{Condition: $2, Statements: $4}
    }
    | WHILE variable IN identifier DO loop_program END WHILE
    {
        $$ = WhileInCursor{Variables: []Variable{$2}, Cursor: $4, Statements: $6}
    }
    | WHILE variables IN identifier DO loop_program END WHILE
    {
        $$ = WhileInCursor{Variables: $2, Cursor: $4, Statements: $6}
    }
    | WHILE while_variable_declaration variable IN identifier DO loop_program END WHILE
    {
        $$ = WhileInCursor{WithDeclaration: true, Variables: []Variable{$3}, Cursor: $5, Statements: $7}
    }
    | WHILE while_variable_declaration variables IN identifier DO loop_program END WHILE
    {
        $$ = WhileInCursor{WithDeclaration: true, Variables: $3, Cursor: $5, Statements: $7}
    }

while_variable_declaration
    : VAR
    {
        $$ = $1
    }
    | DECLARE
    {
        $$ = $1
    }

exit_statement
    : EXIT
    {
        $$ = Exit{}
    }
    | EXIT INTEGER
    {
        $$ = Exit{Code: value.NewIntegerFromString($2.Literal)}
    }

loop_statement
    : common_statement
    {
        $$ = $1
    }
    | loop_flow_control_statement
    {
        $$ = $1
    }

flow_control_statement
    : IF substantial_value THEN program else END IF
    {
        $$ = If{Condition: $2, Statements: $4, Else: $5}
    }
    | IF substantial_value THEN program elseif else END IF
    {
        $$ = If{Condition: $2, Statements: $4, ElseIf: $5, Else: $6}
    }
    | CASE case_value case_when case_else END CASE
    {
        $$ = Case{Value: $2, When: $3, Else: $4}
    }
    | while_statement
    {
        $$ = $1
    }
    | exit_statement
    {
        $$ = $1
    }

loop_flow_control_statement
    : IF substantial_value THEN loop_program in_loop_else END IF
    {
        $$ = If{Condition: $2, Statements: $4, Else: $5}
    }
    | IF substantial_value THEN loop_program in_loop_elseif in_loop_else END IF
    {
        $$ = If{Condition: $2, Statements: $4, ElseIf: $5, Else: $6}
    }
    | CASE case_value in_loop_case_when in_loop_case_else END CASE
    {
        $$ = Case{Value: $2, When: $3, Else: $4}
    }
    | while_statement
    {
        $$ = $1
    }
    | exit_statement
    {
        $$ = $1
    }
    | common_loop_flow_control_statement
    {
        $$ = $1
    }

function_statement
    : common_statement
    {
        $$ = $1
    }
    | function_flow_control_statement
    {
        $$ = $1
    }

function_while_statement
    : WHILE substantial_value DO function_loop_program END WHILE
    {
        $$ = While{Condition: $2, Statements: $4}
    }
    | WHILE variable IN identifier DO function_loop_program END WHILE
    {
        $$ = WhileInCursor{Variables: []Variable{$2}, Cursor: $4, Statements: $6}
    }
    | WHILE variables IN identifier DO function_loop_program END WHILE
    {
        $$ = WhileInCursor{Variables: $2, Cursor: $4, Statements: $6}
    }
    | WHILE while_variable_declaration variable IN identifier DO function_loop_program END WHILE
    {
        $$ = WhileInCursor{WithDeclaration: true, Variables: []Variable{$3}, Cursor: $5, Statements: $7}
    }
    | WHILE while_variable_declaration variables IN identifier DO function_loop_program END WHILE
    {
        $$ = WhileInCursor{WithDeclaration: true, Variables: $3, Cursor: $5, Statements: $7}
    }

function_exit_statement
    : RETURN
    {
        $$ = Return{Value: NewNullValue()}
    }
    | RETURN substantial_value
    {
        $$ = Return{Value: $2}
    }

function_loop_statement
    : common_statement
    {
        $$ = $1
    }
    | function_loop_flow_control_statement
    {
        $$ = $1
    }

function_flow_control_statement
    : IF substantial_value THEN function_program in_function_else END IF
    {
        $$ = If{Condition: $2, Statements: $4, Else: $5}
    }
    | IF substantial_value THEN function_program in_function_elseif in_function_else END IF
    {
        $$ = If{Condition: $2, Statements: $4, ElseIf: $5, Else: $6}
    }
    | CASE case_value in_function_case_when in_function_case_else END CASE
    {
        $$ = Case{Value: $2, When: $3, Else: $4}
    }
    | function_while_statement
    {
        $$ = $1
    }
    | function_exit_statement
    {
        $$ = $1
    }

function_loop_flow_control_statement
    : IF substantial_value THEN function_loop_program in_function_in_loop_else END IF
    {
        $$ = If{Condition: $2, Statements: $4, Else: $5}
    }
    | IF substantial_value THEN function_loop_program in_function_in_loop_elseif in_function_in_loop_else END IF
    {
        $$ = If{Condition: $2, Statements: $4, ElseIf: $5, Else: $6}
    }
    | CASE case_value in_function_in_loop_case_when in_function_in_loop_case_else END CASE
    {
        $$ = Case{Value: $2, When: $3, Else: $4}
    }
    | function_while_statement
    {
        $$ = $1
    }
    | function_exit_statement
    {
        $$ = $1
    }
    | common_loop_flow_control_statement
    {
        $$ = $1
    }

variable_statement
    : VAR variable_assignments
    {
        $$ = VariableDeclaration{Assignments:$2}
    }
    | DECLARE variable_assignments
    {
        $$ = VariableDeclaration{Assignments:$2}
    }
    | variable_substitution
    {
        $$ = $1
    }
    | DISPOSE variable
    {
        $$ = DisposeVariable{Variable:$2}
    }

environment_variable_statement
    : SET environment_variable '=' substantial_value
    {
        $$ = SetEnvVar{EnvVar:$2, Value:$4}
    }
    | SET environment_variable '=' identifier
    {
        $$ = SetEnvVar{EnvVar:$2, Value:$4}
    }
    | SET environment_variable TO substantial_value
    {
        $$ = SetEnvVar{EnvVar:$2, Value:$4}
    }
    | SET environment_variable TO identifier
    {
        $$ = SetEnvVar{EnvVar:$2, Value:$4}
    }
    | UNSET environment_variable
    {
        $$ = UnsetEnvVar{EnvVar:$2}
    }

transaction_statement
    : COMMIT
    {
        $$ = TransactionControl{BaseExpr: NewBaseExpr($1), Token: $1.Token}
    }
    | ROLLBACK
    {
        $$ = TransactionControl{BaseExpr: NewBaseExpr($1), Token: $1.Token}
    }

table_operation_statement
    : CREATE TABLE if_not_exists identifier '(' identifiers ')'
    {
        $$ = CreateTable{Table: $4, Fields: $6, IfNotExists: $3}
    }
    | CREATE TABLE if_not_exists identifier '(' identifiers ')' as select_query
    {
        $$ = CreateTable{Table: $4, Fields: $6, Query: $9, IfNotExists: $3}
    }
    | CREATE TABLE if_not_exists identifier as select_query
    {
        $$ = CreateTable{Table: $4, Query: $6, IfNotExists: $3}
    }
    | ALTER TABLE updatable_table_identifier ADD column_default column_position
    {
        $$ = AddColumns{Table: $3, Columns: []ColumnDefault{$5}, Position: $6}
    }
    | ALTER TABLE updatable_table_identifier ADD '(' column_defaults ')' column_position
    {
        $$ = AddColumns{Table: $3, Columns: $6, Position: $8}
    }
    | ALTER TABLE updatable_table_identifier DROP field_reference
    {
        $$ = DropColumns{Table: $3, Columns: []QueryExpression{$5}}
    }
    | ALTER TABLE updatable_table_identifier DROP '(' field_references ')'
    {
        $$ = DropColumns{Table: $3, Columns: $6}
    }
    | ALTER TABLE updatable_table_identifier RENAME field_reference TO identifier
    {
        $$ = RenameColumn{Table: $3, Old: $5, New: $7}
    }
    | ALTER TABLE updatable_table_identifier SET identifier TO identifier
    {
        $$ = SetTableAttribute{BaseExpr: NewBaseExpr($1), Table: $3, Attribute: $5, Value: $7}
    }
    | ALTER TABLE updatable_table_identifier SET identifier TO substantial_value
    {
        $$ = SetTableAttribute{BaseExpr: NewBaseExpr($1), Table: $3, Attribute: $5, Value: $7}
    }

column_default
    : identifier
    {
        $$ = ColumnDefault{Column: $1}
    }
    | identifier DEFAULT value
    {
        $$ = ColumnDefault{Column: $1, Value: $3}
    }

column_defaults
    : column_default
    {
        $$ = []ColumnDefault{$1}
    }
    | column_default ',' column_defaults
    {
        $$ = append([]ColumnDefault{$1}, $3...)
    }

column_position
    :
    {
        $$ = nil
    }
    | FIRST
    {
        $$ = ColumnPosition{Position: $1}
    }
    | LAST
    {
        $$ = ColumnPosition{Position: $1}
    }
    | AFTER field_reference
    {
        $$ = ColumnPosition{Position: $1, Column: $2}
    }
    | BEFORE field_reference
    {
        $$ = ColumnPosition{Position: $1, Column: $2}
    }

cursor_statement
    : DECLARE identifier CURSOR FOR select_query
    {
        $$ = CursorDeclaration{Cursor:$2, Query: $5.(SelectQuery)}
    }
    | DECLARE identifier CURSOR FOR identifier
    {
        $$ = CursorDeclaration{Cursor:$2, Statement: $5}
    }
    | OPEN identifier
    {
        $$ = OpenCursor{Cursor: $2}
    }
    | OPEN identifier USING replace_values
    {
        $$ = OpenCursor{Cursor: $2, Values: $4}
    }
    | CLOSE identifier
    {
        $$ = CloseCursor{Cursor: $2}
    }
    | DISPOSE CURSOR identifier
    {
        $$ = DisposeCursor{Cursor: $3}
    }
    | FETCH fetch_position identifier INTO variables
    {
        $$ = FetchCursor{Position: $2, Cursor: $3, Variables: $5}
    }

temporary_table_statement
    : DECLARE identifier VIEW '(' identifiers ')'
    {
        $$ = ViewDeclaration{View: $2, Fields: $5}
    }
    | DECLARE identifier VIEW '(' identifiers ')' AS select_query
    {
        $$ = ViewDeclaration{View: $2, Fields: $5, Query: $8}
    }
    | DECLARE identifier VIEW AS select_query
    {
        $$ = ViewDeclaration{View: $2, Query: $5}
    }
    | DISPOSE VIEW identifier
    {
        $$ = DisposeView{View: $3}
    }
    | DISPOSE VIEW STDIN
    {
        $$ = DisposeView{View: Stdin{BaseExpr: NewBaseExpr($3)}}
    }

replace_value
    : substantial_value
    {
        $$ = ReplaceValue{Value: $1}
    }
    | substantial_value AS identifier
    {
        $$ = ReplaceValue{Value: $1, Name: $3}
    }

replace_values
    : replace_value
    {
        $$ = []ReplaceValue{$1}
    }
    | replace_value ',' replace_values
    {
        $$ = append([]ReplaceValue{$1}, $3...)
    }

prepared_statement
    : PREPARE identifier FROM STRING
    {
        $$ = StatementPreparation{Name: $2, Statement: value.NewString($4.Literal)}
    }
    | EXECUTE identifier
    {
        $$ = ExecuteStatement{BaseExpr: NewBaseExpr($1), Name: $2}
    }
    | EXECUTE identifier USING replace_values
    {
        $$ = ExecuteStatement{BaseExpr: NewBaseExpr($1), Name: $2, Values: $4}
    }
    | DISPOSE PREPARE identifier
    {
        $$ = DisposeStatement{Name: $3}
    }

parameter
    : variable
    {
        $$ = VariableAssignment{Variable:$1}
    }

parameters
    : parameter
    {
        $$ = []VariableAssignment{$1}
    }
    | parameters ',' parameter
    {
        $$ = append($1, $3)
    }

optional_parameter
    : variable DEFAULT substantial_value
    {
        $$ = VariableAssignment{Variable: $1, Value: $3}
    }

optional_parameters
    : optional_parameter
    {
        $$ = []VariableAssignment{$1}
    }
    | optional_parameter ',' optional_parameters
    {
        $$ = append([]VariableAssignment{$1}, $3...)
    }

function_parameters
    : parameters
    {
        $$ = $1
    }
    | optional_parameters
    {
        $$ = $1
    }
    | parameters ',' optional_parameters
    {
        $$ = append($1, $3...)
    }

user_defined_function_statement
    : DECLARE identifier FUNCTION '(' ')' AS BEGIN function_program END
    {
        $$ = FunctionDeclaration{Name: $2, Statements: $8}
    }
    | DECLARE identifier FUNCTION '(' function_parameters ')' AS BEGIN function_program END
    {
        $$ = FunctionDeclaration{Name: $2, Parameters: $5, Statements: $9}
    }
    | DECLARE identifier AGGREGATE '(' identifier ')' AS BEGIN function_program END
    {
        $$ = AggregateDeclaration{Name: $2, Cursor: $5, Statements: $9}
    }
    | DECLARE identifier AGGREGATE '(' identifier ',' function_parameters ')' AS BEGIN function_program END
    {
        $$ = AggregateDeclaration{Name: $2, Cursor: $5, Parameters: $7, Statements: $11}
    }
    | DISPOSE FUNCTION identifier
    {
        $$ = DisposeFunction{Name: $3}
    }

fetch_position
    :
    {
        $$ = FetchPosition{}
    }
    | NEXT
    {
        $$ = FetchPosition{Position: $1}
    }
    | PRIOR
    {
        $$ = FetchPosition{Position: $1}
    }
    | FIRST
    {
        $$ = FetchPosition{Position: $1}
    }
    | LAST
    {
        $$ = FetchPosition{Position: $1}
    }
    | ABSOLUTE substantial_value
    {
        $$ = FetchPosition{BaseExpr: NewBaseExpr($1), Position: $1, Number: $2}
    }
    | RELATIVE substantial_value
    {
        $$ = FetchPosition{BaseExpr: NewBaseExpr($1), Position: $1, Number: $2}
    }

cursor_status
    : CURSOR identifier IS negation OPEN
    {
        $$ = CursorStatus{Cursor: $2, Negation: $4, Type: $5}
    }
    | CURSOR identifier IS negation IN RANGE
    {
        $$ = CursorStatus{Cursor: $2, Negation: $4, Type: $6}
    }
    | CURSOR identifier COUNT
    {
        $$ = CursorAttrebute{Cursor: $2, Attrebute: $3}
    }

command_statement
    : SET flag '=' identifier
    {
        $$ = SetFlag{BaseExpr: NewBaseExpr($1), Flag: $2, Value: $4}
    }
    | SET flag '=' substantial_value
    {
        $$ = SetFlag{BaseExpr: NewBaseExpr($1), Flag: $2, Value: $4}
    }
    | SET flag TO identifier
    {
        $$ = SetFlag{BaseExpr: NewBaseExpr($1), Flag: $2, Value: $4}
    }
    | SET flag TO substantial_value
    {
        $$ = SetFlag{BaseExpr: NewBaseExpr($1), Flag: $2, Value: $4}
    }
    | ADD substantial_value TO flag
    {
        $$ = AddFlagElement{BaseExpr: NewBaseExpr($1), Flag: $4, Value: $2}
    }
    | REMOVE substantial_value FROM flag
    {
        $$ = RemoveFlagElement{BaseExpr: NewBaseExpr($1), Flag: $4, Value: $2}
    }
    | SHOW flag
    {
        $$ = ShowFlag{BaseExpr: NewBaseExpr($1), Flag: $2}
    }
    | ECHO substantial_value
    {
        $$ = Echo{Value: $2}
    }
    | PRINT substantial_value
    {
        $$ = Print{Value: $2}
    }
    | PRINTF substantial_value
    {
        $$ = Printf{BaseExpr: NewBaseExpr($1), Format: $2}
    }
    | PRINTF substantial_value ',' substantial_values
    {
        $$ = Printf{BaseExpr: NewBaseExpr($1), Format: $2, Values: $4}
    }
    | PRINTF substantial_value USING substantial_values
    {
        $$ = Printf{BaseExpr: NewBaseExpr($1), Format: $2, Values: $4}
    }
    | SOURCE identifier
    {
        $$ = Source{BaseExpr: NewBaseExpr($1), FilePath: $2}
    }
    | SOURCE substantial_value
    {
        $$ = Source{BaseExpr: NewBaseExpr($1), FilePath: $2}
    }
    | EXECUTE substantial_value
    {
        $$ = Execute{BaseExpr: NewBaseExpr($1), Statements: $2}
    }
    | EXECUTE substantial_value USING substantial_values
    {
        $$ = Execute{BaseExpr: NewBaseExpr($1), Statements: $2, Values: $4}
    }
    | SYNTAX
    {
        $$ = Syntax{BaseExpr: NewBaseExpr($1)}
    }
    | SYNTAX values
    {
        $$ = Syntax{BaseExpr: NewBaseExpr($1), Keywords: $2}
    }
    | SHOW identifier
    {
        $$ = ShowObjects{BaseExpr: NewBaseExpr($1), Type: $2}
    }
    | SHOW identifier FROM updatable_table_identifier
    {
        $$ = ShowFields{BaseExpr: NewBaseExpr($1), Type: $2, Table: $4}
    }
    | CHDIR identifier
    {
        $$ = Chdir{BaseExpr: NewBaseExpr($1), DirPath: $2}
    }
    | CHDIR substantial_value
    {
        $$ = Chdir{BaseExpr: NewBaseExpr($1), DirPath: $2}
    }
    | PWD
    {
        $$ = Pwd{BaseExpr: NewBaseExpr($1)}
    }
    | RELOAD identifier
    {
        $$ = Reload{BaseExpr: NewBaseExpr($1), Type: $2}
    }

trigger_statement
    : TRIGGER identifier
    {
        $$ = Trigger{BaseExpr: NewBaseExpr($1), Event: $2}
    }
    | TRIGGER identifier substantial_value
    {
        $$ = Trigger{BaseExpr: NewBaseExpr($1), Event: $2, Message: $3}
    }
    | TRIGGER identifier INTEGER substantial_value
    {
        $$ = Trigger{BaseExpr: NewBaseExpr($1), Event: $2, Message: $4, Code: value.NewIntegerFromString($3.Literal)}
    }

select_query
    : select_entity order_by_clause limit_clause
    {
        $$ = SelectQuery{
            SelectEntity:  $1,
            OrderByClause: $2,
            LimitClause:   $3,
        }
    }
    | select_entity order_by_clause limit_clause FOR UPDATE
    {
        $$ = SelectQuery{
            SelectEntity:  $1,
            OrderByClause: $2,
            LimitClause:   $3,
            Context:       $5,
        }
    }
    | with_clause select_entity order_by_clause limit_clause
    {
        $$ = SelectQuery{
            WithClause:    $1,
            SelectEntity:  $2,
            OrderByClause: $3,
            LimitClause:   $4,
        }
    }
    | with_clause select_entity order_by_clause limit_clause FOR UPDATE
    {
        $$ = SelectQuery{
            WithClause:    $1,
            SelectEntity:  $2,
            OrderByClause: $3,
            LimitClause:   $4,
            Context:       $6,
        }
    }

select_into_query
    : select_clause into_clause from_clause where_clause group_by_clause having_clause order_by_clause limit_clause
    {
        $$ = SelectQuery{
            SelectEntity:  SelectEntity{
                SelectClause:  $1,
                IntoClause:    $2,
                FromClause:    $3,
                WhereClause:   $4,
                GroupByClause: $5,
                HavingClause:  $6,
            },
            OrderByClause: $7,
            LimitClause:   $8,
        }
    }
    | select_clause into_clause from_clause where_clause group_by_clause having_clause order_by_clause limit_clause FOR UPDATE
    {
        $$ = SelectQuery{
            SelectEntity:  SelectEntity{
                SelectClause:  $1,
                IntoClause:    $2,
                FromClause:    $3,
                WhereClause:   $4,
                GroupByClause: $5,
                HavingClause:  $6,
            },
            OrderByClause: $7,
            LimitClause:   $8,
            Context:       $10,
        }
    }
    | with_clause select_clause into_clause from_clause where_clause group_by_clause having_clause order_by_clause limit_clause
    {
        $$ = SelectQuery{
            WithClause:    $1,
            SelectEntity:  SelectEntity{
                SelectClause:  $2,
                IntoClause:    $3,
                FromClause:    $4,
                WhereClause:   $5,
                GroupByClause: $6,
                HavingClause:  $7,
            },
            OrderByClause: $8,
            LimitClause:   $9,
        }
    }
    | with_clause select_clause into_clause from_clause where_clause group_by_clause having_clause order_by_clause limit_clause FOR UPDATE
    {
        $$ = SelectQuery{
            WithClause:    $1,
            SelectEntity:  SelectEntity{
                SelectClause:  $2,
                IntoClause:    $3,
                FromClause:    $4,
                WhereClause:   $5,
                GroupByClause: $6,
                HavingClause:  $7,
            },
            OrderByClause: $8,
            LimitClause:   $9,
            Context:       $11,
        }
    }

select_entity
    : select_clause from_clause where_clause group_by_clause having_clause
    {
        $$ = SelectEntity{
            SelectClause:  $1,
            FromClause:    $2,
            WhereClause:   $3,
            GroupByClause: $4,
            HavingClause:  $5,
        }
    }
    | select_set_entity UNION all select_set_entity
    {
        $$ = SelectSet{
            LHS:      $1,
            Operator: $2,
            All:      $3,
            RHS:      $4,
        }
    }
    | select_set_entity INTERSECT all select_set_entity
    {
        $$ = SelectSet{
            LHS:      $1,
            Operator: $2,
            All:      $3,
            RHS:      $4,
        }
    }
    | select_set_entity EXCEPT all select_set_entity
    {
        $$ = SelectSet{
            LHS:      $1,
            Operator: $2,
            All:      $3,
            RHS:      $4,
        }
    }

select_set_entity
    : select_entity
    {
        $$ = $1
    }
    | subquery
    {
        $$ = $1
    }

select_clause
    : SELECT distinct fields
    {
        $$ = SelectClause{BaseExpr: NewBaseExpr($1), Distinct: $2, Fields: $3}
    }

into_clause
    : INTO variables
    {
        $$ = IntoClause{Variables: $2}
    }

from_clause
    :
    {
        $$ = nil
    }
    | FROM tables
    {
        $$ = FromClause{Tables: $2}
    }

where_clause
    :
    {
        $$ = nil
    }
    | WHERE value
    {
        $$ = WhereClause{Filter: $2}
    }

group_by_clause
    :
    {
        $$ = nil
    }
    | GROUP BY values
    {
        $$ = GroupByClause{Items: $3}
    }

having_clause
    :
    {
        $$ = nil
    }
    | HAVING value
    {
        $$ = HavingClause{Filter: $2}
    }

order_by_clause
    :
    {
        $$ = nil
    }
    | ORDER BY order_items
    {
        $$ = OrderByClause{Items: $3}
    }

limit_clause
    : offset_clause
    {
        if $1 == nil {
            $$ = $1
        } else {
            $$ = LimitClause{BaseExpr: $1.(OffsetClause).BaseExpr, OffsetClause: $1}
        }
    }
    | offset_clause FETCH limit_fetch_position substantial_value limit_fetch_unit limit_restriction
    {
        var base *BaseExpr
        if $1 == nil {
            base = NewBaseExpr($2)
        } else {
            base = $1.(OffsetClause).BaseExpr
        }
        $$ = LimitClause{BaseExpr: base, Type: $2, Position: $3, Value: $4, Unit: $5, Restriction: $6, OffsetClause: $1}
    }
    | LIMIT substantial_value limit_unit limit_restriction offset_clause
    {
        $$ = LimitClause{BaseExpr: NewBaseExpr($1), Type: $1, Value: $2, Unit: $3, Restriction: $4, OffsetClause: $5}
    }

limit_restriction
    :
    {
        $$ = Token{}
    }
    | ONLY
    {
        $$ = $1
    }
    | WITH TIES
    {
        $$ = $2
    }

limit_fetch_position
    : FIRST
    {
        $$ = $1
    }
    | NEXT
    {
        $$ = $1
    }

limit_unit
    :
    {
        $$ = Token{}
    }
    | limit_fetch_unit
    {
        $$ = $1
    }

limit_fetch_unit
    : PERCENT
    {
        $$ = $1
    }
    | ROW
    {
        $$ = $1
    }
    | ROWS
    {
        $$ = $1
    }

offset_unit
    :
    {
        $$ = Token{}
    }
    | ROW
    {
        $$ = $1
    }
    | ROWS
    {
        $$ = $1
    }

offset_clause
    :
    {
        $$ = nil
    }
    | OFFSET substantial_value offset_unit
    {
        $$ = OffsetClause{BaseExpr: NewBaseExpr($1), Value: $2, Unit: $3}
    }

with_clause
    :
    {
        $$ = nil
    }
    | WITH inline_tables
    {
        $$ = WithClause{InlineTables: $2}
    }

inline_table
    : recursive identifier AS '(' select_query ')'
    {
        $$ = InlineTable{Recursive: $1, Name: $2, Query: $5.(SelectQuery)}
    }
    | recursive identifier '(' identifiers ')' AS '(' select_query ')'
    {
        $$ = InlineTable{Recursive: $1, Name: $2, Fields: $4, Query: $8.(SelectQuery)}
    }

inline_tables
    : inline_table
    {
        $$ = []QueryExpression{$1}
    }
    | inline_table ',' inline_tables
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

primitive_type
    : STRING
    {
        $$ = NewStringValue($1.Literal)
    }
    | INTEGER
    {
        i, err := strconv.ParseInt($1.Literal, 10, 64)
        if err != nil {
          $$ = NewFloatValueFromString($1.Literal)
        } else {
          iv := NewIntegerValue(i)
          iv.Literal = $1.Literal
          $$ = iv
        }
    }
    | FLOAT
    {
        $$ = NewFloatValueFromString($1.Literal)
    }
    | ternary
    {
        $$ = $1
    }
    | null
    {
        $$ = $1
    }

ternary
    : TERNARY
    {
        $$ = NewTernaryValueFromString($1.Literal)
    }

null
    : NULL
    {
        $$ = NewNullValue()
    }

field_reference
    : identifier
    {
        $$ = FieldReference{BaseExpr: $1.BaseExpr, Column: $1}
    }
    | identifier '.' identifier
    {
        $$ = FieldReference{BaseExpr: $1.BaseExpr, View: $1, Column: $3}
    }
    | STDIN '.' identifier
    {
        $$ = FieldReference{BaseExpr: NewBaseExpr($1), View: Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal}, Column: $3}
    }
    | identifier '.' INTEGER
    {
        $$ = ColumnNumber{BaseExpr: $1.BaseExpr, View: $1, Number: value.NewIntegerFromString($3.Literal)}
    }
    | STDIN '.' INTEGER
    {
        $$ = ColumnNumber{BaseExpr: NewBaseExpr($1), View: Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal}, Number: value.NewIntegerFromString($3.Literal)}
    }

value
    : field_reference
    {
        $$ = $1
    }
    | substantial_value
    {
        $$ = $1
    }
    | '(' value ')'
    {
        $$ = Parentheses{Expr: $2}
    }

substantial_value
    : primitive_type
    {
        $$ = $1
    }
    | arithmetic
    {
        $$ = $1
    }
    | string_operation
    {
        $$ = $1
    }
    | subquery
    {
        $$ = $1
    }
    | function
    {
        $$ = $1
    }
    | aggregate_function
    {
        $$ = $1
    }
    | analytic_function
    {
        $$ = $1
    }
    | case_expr
    {
        $$ = $1
    }
    | comparison
    {
        $$ = $1
    }
    | logic
    {
        $$ = $1
    }
    | variable
    {
        $$ = $1
    }
    | variable_substitution
    {
        $$ = $1
    }
    | environment_variable
    {
        $$ = $1
    }
    | runtime_information
    {
        $$ = $1
    }
    | constant
    {
        $$ = $1
    }
    | flag
    {
        $$ = $1
    }
    | cursor_status
    {
        $$ = $1
    }
    | '(' substantial_value ')'
    {
        $$ = Parentheses{Expr: $2}
    }
    | PLACEHOLDER
    {
        name := ""
        if $1.Literal[0] == ':' {
            name = $1.Literal[1:]
        }
        $$ = Placeholder{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Ordinal: $1.HolderOrdinal, Name: name}
    }

wildcard
    : '*'
    {
        $$ = AllColumns{BaseExpr: NewBaseExpr($1)}
    }

row_value
    : '(' values ')'
    {
        $$ = RowValue{BaseExpr: NewBaseExpr($1), Value: ValueList{Values: $2}}
    }
    | subquery
    {
        $$ = RowValue{BaseExpr: $1.GetBaseExpr(), Value: $1}
    }
    | JSON_ROW '(' value ',' value ')'
    {
        $$ = RowValue{BaseExpr: NewBaseExpr($1), Value: JsonQuery{JsonQuery: $1, Query: $3, JsonText: $5}}
    }

row_values
    : row_value
    {
        $$ = []QueryExpression{$1}
    }
    | row_value ',' row_values
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

order_items
    : order_item
    {
        $$ = []QueryExpression{$1}
    }
    | order_item ',' order_items
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

order_item
    : value order_direction
    {
        $$ = OrderItem{Value: $1, Direction: $2}
    }
    | value order_direction NULLS order_null_position
    {
        $$ = OrderItem{Value: $1, Direction: $2, NullsPosition: $4}
    }

order_direction
    :
    {
        $$ = Token{}
    }
    | ASC
    {
        $$ = $1
    }
    | DESC
    {
        $$ = $1
    }

order_null_position
    : FIRST
    {
        $$ = $1
    }
    | LAST
    {
        $$ = $1
    }

subquery
    : '(' select_query ')'
    {
        $$ = Subquery{BaseExpr: NewBaseExpr($1), Query: $2.(SelectQuery)}
    }

string_operation
    : value STRING_OP value
    {
        var item1 []QueryExpression
        var item2 []QueryExpression

        c1, ok := $1.(Concat)
        if ok {
            item1 = c1.Items
        } else {
            item1 = []QueryExpression{$1}
        }

        c2, ok := $3.(Concat)
        if ok {
            item2 = c2.Items
        } else {
            item2 = []QueryExpression{$3}
        }

        $$ = Concat{Items: append(item1, item2...)}
    }

matrix_value
    : '(' row_values ')'
    {
        $$ = RowValueList{RowValues: $2}
    }
    | subquery
    {
        $$ = $1
    }
    | JSON_ROW '(' value ',' value ')'
    {
        $$ = JsonQuery{BaseExpr: NewBaseExpr($1), JsonQuery: $1, Query: $3, JsonText: $5}
    }

comparison
    : value COMPARISON_OP value
    {
        $$ = Comparison{LHS: $1, Operator: $2, RHS: $3}
    }
    | row_value COMPARISON_OP row_value
    {
        $$ = Comparison{LHS: $1, Operator: $2, RHS: $3}
    }
    | value '=' value
    {
        $$ = Comparison{LHS: $1, Operator: $2, RHS: $3}
    }
    | row_value '=' row_value
    {
        $$ = Comparison{LHS: $1, Operator: $2, RHS: $3}
    }
    | value IS negation ternary
    {
        $$ = Is{LHS: $1, RHS: $4, Negation: $3}
    }
    | value IS negation null
    {
        $$ = Is{LHS: $1, RHS: $4, Negation: $3}
    }
    | value BETWEEN value AND value
    {
        $$ = Between{LHS: $1, Low: $3, High: $5}
    }
    | value NOT BETWEEN value AND value
    {
        $$ = Between{LHS: $1, Low: $4, High: $6, Negation: $2}
    }
    | row_value negation BETWEEN row_value AND row_value
    {
        $$ = Between{LHS: $1, Low: $4, High: $6, Negation: $2}
    }
    | value IN row_value
    {
        $$ = In{LHS: $1, Values: $3}
    }
    | value NOT IN row_value
    {
        $$ = In{LHS: $1, Values: $4, Negation: $2}
    }
    | row_value negation IN matrix_value
    {
        $$ = In{LHS: $1, Values: $4, Negation: $2}
    }
    | value LIKE value
    {
        $$ = Like{LHS: $1, Pattern: $3}
    }
    | value NOT LIKE value
    {
        $$ = Like{LHS: $1, Pattern: $4, Negation: $2}
    }
    | value comparison_operator ANY row_value
    {
        $$ = Any{LHS: $1, Operator: $2, Values: $4}
    }
    | row_value comparison_operator ANY matrix_value
    {
        $$ = Any{LHS: $1, Operator: $2, Values: $4}
    }
    | value comparison_operator ALL row_value
    {
        $$ = All{LHS: $1, Operator: $2, Values: $4}
    }
    | row_value comparison_operator ALL matrix_value
    {
        $$ = All{LHS: $1, Operator: $2, Values: $4}
    }
    | EXISTS subquery
    {
        $$ = Exists{Query: $2.(Subquery)}
    }

arithmetic
    : value '+' value
    {
        $$ = Arithmetic{BaseExpr: NewBaseExpr($2), LHS: $1, Operator: $2, RHS: $3}
    }
    | value '-' value
    {
        $$ = Arithmetic{BaseExpr: NewBaseExpr($2), LHS: $1, Operator: $2, RHS: $3}
    }
    | value '*' value
    {
        $$ = Arithmetic{BaseExpr: NewBaseExpr($2), LHS: $1, Operator: $2, RHS: $3}
    }
    | value '/' value
    {
        $$ = Arithmetic{BaseExpr: NewBaseExpr($2), LHS: $1, Operator: $2, RHS: $3}
    }
    | value '%' value
    {
        $$ = Arithmetic{BaseExpr: NewBaseExpr($2), LHS: $1, Operator: $2, RHS: $3}
    }
    | '-' value %prec UMINUS
    {
        $$ = UnaryArithmetic{Operand: $2, Operator: $1}
    }
    | '+' value %prec UPLUS
    {
        $$ = UnaryArithmetic{Operand: $2, Operator: $1}
    }

logic
    : value OR value
    {
        $$ = Logic{LHS: $1, Operator: $2, RHS: $3}
    }
    | value AND value
    {
        $$ = Logic{LHS: $1, Operator: $2, RHS: $3}
    }
    | NOT value
    {
        $$ = UnaryLogic{Operand: $2, Operator: $1}
    }
    | '!' value
    {
        $$ = UnaryLogic{Operand: $2, Operator: $1}
    }

arguments
    :
    {
        $$ = nil
    }
    | values
    {
        $$ = $1
    }

function
    : identifier '(' arguments ')'
    {
        $$ = Function{BaseExpr: $1.BaseExpr, Name: $1.Literal, Args: $3}
    }
    | SUBSTRING '(' arguments ')'
    {
        $$ = Function{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3}
    }
    | SUBSTRING '(' value FROM value ')'
    {
        $$ = Function{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: []QueryExpression{$3, $5}, From: $4}
    }
    | SUBSTRING '(' value FROM value FOR value ')'
    {
        $$ = Function{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: []QueryExpression{$3, $5, $7}, From: $4, For: $6}
    }
    | JSON_OBJECT '(' ')'
    {
        $$ = Function{BaseExpr: NewBaseExpr($1), Name: $1.Literal}
    }
    | JSON_OBJECT '(' fields ')'
    {
        $$ = Function{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3}
    }
    | IF '(' arguments ')'
    {
        $$ = Function{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3}
    }
    | REPLACE '(' arguments ')'
    {
        $$ = Function{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3}
    }


aggregate_function
    : identifier '(' distinct arguments ')'
    {
        $$ = AggregateFunction{BaseExpr: $1.BaseExpr, Name: $1.Literal, Distinct: $3, Args: $4}
    }
    | AGGREGATE_FUNCTION '(' distinct arguments ')'
    {
        $$ = AggregateFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4}
    }
    | VAR '(' distinct arguments ')'
    {
        $$ = AggregateFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4}
    }
    | COUNT '(' distinct arguments ')'
    {
        $$ = AggregateFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4}
    }
    | COUNT '(' distinct wildcard ')'
    {
        $$ = AggregateFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: []QueryExpression{$4}}
    }
    | list_function
    {
        $$ = $1
    }

list_function
    : LIST_FUNCTION '(' distinct arguments ')'
    {
        $$ = ListFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4}
    }
    | LIST_FUNCTION '(' distinct arguments ')' WITHIN GROUP '(' order_by_clause ')'
    {
        $$ = ListFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4, OrderBy: $9}
    }

analytic_function
    : identifier '(' arguments ')' OVER '(' analytic_clause_with_windowing ')'
    {
        $$ = AnalyticFunction{BaseExpr: $1.BaseExpr, Name: $1.Literal, Args: $3, AnalyticClause: $7.(AnalyticClause)}
    }
    | identifier '(' distinct arguments ')' OVER '(' analytic_clause_with_windowing ')'
    {
        $$ = AnalyticFunction{BaseExpr: $1.BaseExpr, Name: $1.Literal, Distinct: $3, Args: $4, AnalyticClause: $8.(AnalyticClause)}
    }
    | AGGREGATE_FUNCTION '(' distinct arguments ')' OVER '(' analytic_clause_with_windowing ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4, AnalyticClause: $8.(AnalyticClause)}
    }
    | VAR '(' distinct arguments ')' OVER '(' analytic_clause_with_windowing ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4, AnalyticClause: $8.(AnalyticClause)}
    }
    | COUNT '(' distinct arguments ')' OVER '(' analytic_clause_with_windowing ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4, AnalyticClause: $8.(AnalyticClause)}
    }
    | COUNT '(' distinct wildcard ')' OVER '(' analytic_clause_with_windowing ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: []QueryExpression{$4}, AnalyticClause: $8.(AnalyticClause)}
    }
    | LIST_FUNCTION '(' distinct arguments ')' OVER '(' analytic_clause ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Distinct: $3, Args: $4, AnalyticClause: $8.(AnalyticClause)}
    }
    | ANALYTIC_FUNCTION '(' arguments ')' OVER '(' analytic_clause ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3, AnalyticClause: $7.(AnalyticClause)}
    }
    | FUNCTION_NTH '(' arguments ')' OVER '(' analytic_clause_with_windowing ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3, AnalyticClause: $7.(AnalyticClause)}
    }
    | FUNCTION_NTH '(' arguments ')' IGNORE NULLS OVER '(' analytic_clause_with_windowing ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3, IgnoreType: $6, AnalyticClause: $9.(AnalyticClause)}
    }
    | FUNCTION_WITH_INS '(' arguments ')' OVER '(' analytic_clause ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3, AnalyticClause: $7.(AnalyticClause)}
    }
    | FUNCTION_WITH_INS '(' arguments ')' IGNORE NULLS OVER '(' analytic_clause ')'
    {
        $$ = AnalyticFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3, IgnoreType: $6, AnalyticClause: $9.(AnalyticClause)}
    }

analytic_clause
    : partition_clause order_by_clause
    {
        $$ = AnalyticClause{PartitionClause: $1, OrderByClause: $2}
    }

analytic_clause_with_windowing
    : analytic_clause
    {
        $$ = $1
    }
    | partition_clause ORDER BY order_items windowing_clause
    {
        $$ = AnalyticClause{PartitionClause: $1, OrderByClause: OrderByClause{Items: $4}, WindowingClause: $5}
    }

partition_clause
    :
    {
        $$ = nil
    }
    | PARTITION BY values
    {
        $$ = PartitionClause{Values: $3}
    }

windowing_clause
    : ROWS window_position
    {
        $$ = WindowingClause{FrameLow: $2}
    }
    | ROWS BETWEEN window_frame_low AND window_frame_high
    {
        $$ = WindowingClause{FrameLow: $3, FrameHigh: $5}
    }

window_position
    : UNBOUNDED PRECEDING
    {
        $$ = WindowFramePosition{Direction: $2, Unbounded: $1}
    }
    | INTEGER PRECEDING
    {
        i, _ := strconv.Atoi($1.Literal)
        $$ = WindowFramePosition{Direction: $2, Offset: i}
    }
    | CURRENT ROW
    {
        $$ = WindowFramePosition{Direction: $1}
    }

window_relative_position
    : INTEGER PRECEDING
    {
        i, _ := strconv.Atoi($1.Literal)
        $$ = WindowFramePosition{Direction: $2, Offset: i}
    }
    | INTEGER FOLLOWING
    {
        i, _ := strconv.Atoi($1.Literal)
        $$ = WindowFramePosition{Direction: $2, Offset: i}
    }
    | CURRENT ROW
    {
        $$ = WindowFramePosition{Direction: $1}
    }

window_frame_low
    : UNBOUNDED PRECEDING
    {
        $$ = WindowFramePosition{Direction: $2, Unbounded: $1}
    }
    | window_relative_position
    {
        $$ = $1
    }

window_frame_high
    : UNBOUNDED FOLLOWING
    {
        $$ = WindowFramePosition{Direction: $2, Unbounded: $1}
    }
    | window_relative_position
    {
        $$ = $1
    }

table_identifier
    : identifier
    {
        $$ = $1
    }
    | URL
    {
        $$ = Url{BaseExpr: NewBaseExpr($1), Raw: $1.Literal}
    }
    | TABLE_FUNCTION '(' arguments ')'
    {
        $$ = TableFunction{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Args: $3}
    }
    | STDIN
    {
        $$ = Stdin{BaseExpr: NewBaseExpr($1)}
    }

table_format
    : CSV
    {
        $$ = $1
    }
    | JSON
    {
        $$ = $1
    }
    | JSONL
    {
        $$ = $1
    }
    | FIXED
    {
        $$ = $1
    }
    | LTSV
    {
        $$ = $1
    }

inline_table_format
    : CSV_INLINE
    {
        $$ = $1
    }
    | JSON_INLINE
    {
        $$ = $1
    }
    | JSON_TABLE
    {
        $$ = $1
    }

format_specified_function
    : table_format '(' table_identifier ')'
    {
        $$ = FormatSpecifiedFunction{BaseExpr: NewBaseExpr($1), Type: $1, Path: $3, Args: nil}
    }
    | table_format '(' table_identifier ',' arguments ')'
    {
        $$ = FormatSpecifiedFunction{BaseExpr: NewBaseExpr($1), Type: $1, Path: $3, Args: $5}
    }
    | table_format '(' substantial_value ',' table_identifier ')'
    {
        $$ = FormatSpecifiedFunction{BaseExpr: NewBaseExpr($1), Type: $1, FormatElement: $3, Path: $5, Args: nil}
    }
    | table_format '(' substantial_value ',' table_identifier ',' arguments ')'
    {
        $$ = FormatSpecifiedFunction{BaseExpr: NewBaseExpr($1), Type: $1, FormatElement: $3, Path: $5, Args: $7}
    }

inline_format_specified_function
    : inline_table_format '(' substantial_value ',' identifier ')'
    {
        $$ = FormatSpecifiedFunction{BaseExpr: NewBaseExpr($1), Type: $1, FormatElement: $3, Path: $5, Args: nil}
    }
    | inline_table_format '(' substantial_value ',' identifier ',' arguments ')'
    {
        $$ = FormatSpecifiedFunction{BaseExpr: NewBaseExpr($1), Type: $1, FormatElement: $3, Path: $5, Args: $7}
    }
    | inline_table_format '(' substantial_value ',' substantial_value ')'
    {
        $$ = FormatSpecifiedFunction{BaseExpr: NewBaseExpr($1), Type: $1, FormatElement: $3, Path: $5, Args: nil}
    }
    | inline_table_format '(' substantial_value ',' substantial_value ',' arguments ')'
    {
        $$ = FormatSpecifiedFunction{BaseExpr: NewBaseExpr($1), Type: $1, FormatElement: $3, Path: $5, Args: $7}
    }

updatable_table_identifier
    : table_identifier
    {
        $$ = $1
    }
    | format_specified_function
    {
        $$ = $1
    }

table_object
    : updatable_table_identifier
    {
        $$ = $1
    }
    | inline_format_specified_function
    {
        $$ = $1
    }

laterable_query_table
    : subquery
    {
        $$ = Table{Object: $1}
    }
    | subquery identifier
    {
        $$ = Table{Object: $1, Alias: $2}
    }
    | subquery AS identifier
    {
        $$ = Table{Object: $1, As: $2, Alias: $3}
    }

joinable_tables
    : table
    {
        $$ = []QueryExpression{$1}
    }
    | LATERAL laterable_query_table
    {
        $2.Lateral = $1
        $2.BaseExpr = NewBaseExpr($1)
        $$ = []QueryExpression{$2}
    }
    | laterable_query_table ',' joinable_tables
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }
    | LATERAL laterable_query_table ',' joinable_tables
    {
        $2.Lateral = $1
        $2.BaseExpr = NewBaseExpr($1)
        $$ = append([]QueryExpression{$2}, $4...)
    }

table
    : table_object
    {
        $$ = Table{Object: $1}
    }
    | table_object identifier
    {
        $$ = Table{Object: $1, Alias: $2}
    }
    | table_object AS identifier
    {
        $$ = Table{Object: $1, As: $2, Alias: $3}
    }
    | join
    {
        $$ = Table{Object: $1}
    }
    | DUAL
    {
        $$ = Table{Object: Dual{}}
    }
    | laterable_query_table
    {
        $$ = $1
    }
    | '(' table ')'
    {
        $$ = Parentheses{Expr: $2}
    }

join
    : table CROSS JOIN table
    {
        $$ = Join{Table: $1, JoinTable: $4, JoinType: $2, Condition: nil}
    }
    | table join_type_inner JOIN table join_condition
    {
        $$ = Join{Table: $1, JoinTable: $4, JoinType: $2, Condition: $5}
    }
    | table join_outer_direction join_type_outer JOIN table join_condition
    {
        $$ = Join{Table: $1, JoinTable: $5, JoinType: $3, Direction: $2, Condition: $6}
    }
    | table NATURAL join_type_inner JOIN table
    {
        $$ = Join{Table: $1, JoinTable: $5, JoinType: $3, Natural: $2}
    }
    | table NATURAL join_outer_direction join_type_outer JOIN table
    {
        $$ = Join{Table: $1, JoinTable: $6, JoinType: $4, Direction: $3, Natural: $2}
    }
    | table CROSS JOIN LATERAL laterable_query_table
    {
        $5.Lateral = $4
        $5.BaseExpr = NewBaseExpr($4)
        $$ = Join{Table: $1, JoinTable: $5, JoinType: $2, Condition: nil}
    }
    | table join_type_inner JOIN LATERAL laterable_query_table join_condition
    {
        $5.Lateral = $4
        $5.BaseExpr = NewBaseExpr($4)
        $$ = Join{Table: $1, JoinTable: $5, JoinType: $2, Condition: $6}
    }
    | table join_outer_direction join_type_outer JOIN LATERAL laterable_query_table join_condition
    {
        $6.Lateral = $5
        $6.BaseExpr = NewBaseExpr($5)
        $$ = Join{Table: $1, JoinTable: $6, JoinType: $3, Direction: $2, Condition: $7}
    }
    | table NATURAL join_type_inner JOIN LATERAL laterable_query_table
    {
        $6.Lateral = $5
        $6.BaseExpr = NewBaseExpr($5)
        $$ = Join{Table: $1, JoinTable: $6, JoinType: $3, Natural: $2}
    }
    | table NATURAL join_outer_direction join_type_outer JOIN LATERAL laterable_query_table
    {
        $7.Lateral = $6
        $7.BaseExpr = NewBaseExpr($6)
        $$ = Join{Table: $1, JoinTable: $7, JoinType: $4, Direction: $3, Natural: $2}
    }

join_condition
    : ON value
    {
        $$ = JoinCondition{On: $2}
    }
    | USING '(' identifiers ')'
    {
        $$ = JoinCondition{Using: $3}
    }

field
    : value
    {
        $$ = Field{Object: $1}
    }
    | value AS identifier
    {
        $$ = Field{Object: $1, As: $2, Alias: $3}
    }
    | wildcard
    {
        $$ = Field{Object: $1}
    }
    | identifier '.' wildcard
    {
        $$ = Field{Object: FieldReference{BaseExpr: $1.BaseExpr, View: $1, Column: $3}}
    }

case_expr
    : CASE case_value case_expr_when case_expr_else END
    {
        $$ = CaseExpr{Value: $2, When: $3, Else: $4}
    }

case_value
    :
    {
        $$ = nil
    }
    | value
    {
        $$ = $1
    }

case_expr_when
    : WHEN value THEN value
    {
        $$ = []QueryExpression{CaseExprWhen{Condition: $2, Result: $4}}
    }
    | WHEN value THEN value case_expr_when
    {
        $$ = append([]QueryExpression{CaseExprWhen{Condition: $2, Result: $4}}, $5...)
    }

case_expr_else
    :
    {
        $$ = nil
    }
    | ELSE value
    {
        $$ = CaseExprElse{Result: $2}
    }

field_references
    : field_reference
    {
        $$ = []QueryExpression{$1}
    }
    | field_reference ',' field_references
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

values
    : value
    {
        $$ = []QueryExpression{$1}
    }
    | value ',' values
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

substantial_values
    : substantial_value
    {
        $$ = []QueryExpression{$1}
    }
    | substantial_value ',' substantial_values
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

tables
    : table
    {
        $$ = []QueryExpression{$1}
    }
    | table ',' joinable_tables
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

identified_tables
    : table_identifier
    {
        $$ = []QueryExpression{Table{Object: $1}}
    }
    | table_identifier ',' identified_tables
    {
        $$ = append([]QueryExpression{Table{Object: $1}}, $3...)
    }

updatable_tables
    : updatable_table_identifier
    {
        $$ = []QueryExpression{Table{Object: $1}}
    }
    | updatable_table_identifier ',' updatable_tables
    {
        $$ = append([]QueryExpression{Table{Object: $1}}, $3...)
    }

identifiers
    : identifier
    {
        $$ = []QueryExpression{$1}
    }
    | identifier ',' identifiers
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

fields
    : field
    {
        $$ = []QueryExpression{$1}
    }
    | field ',' fields
    {
        $$ = append([]QueryExpression{$1}, $3...)
    }

insert_query
    : with_clause INSERT INTO updatable_table_identifier VALUES row_values
    {
        $$ = InsertQuery{WithClause: $1, Table: Table{Object: $4}, ValuesList: $6}
    }
    | with_clause INSERT INTO updatable_table_identifier '(' field_references ')' VALUES row_values
    {
        $$ = InsertQuery{WithClause: $1, Table: Table{Object: $4}, Fields: $6, ValuesList: $9}
    }
    | with_clause INSERT INTO updatable_table_identifier select_query
    {
        $$ = InsertQuery{WithClause: $1, Table: Table{Object: $4}, Query: $5.(SelectQuery)}
    }
    | with_clause INSERT INTO updatable_table_identifier '(' field_references ')' select_query
    {
        $$ = InsertQuery{WithClause: $1, Table: Table{Object: $4}, Fields: $6, Query: $8.(SelectQuery)}
    }

update_query
    : with_clause UPDATE updatable_tables SET update_set_list from_clause where_clause
    {
        $$ = UpdateQuery{WithClause: $1, Tables: $3, SetList: $5, FromClause: $6, WhereClause: $7}
    }

update_set
    : field_reference '=' value
    {
        $$ = UpdateSet{Field: $1, Value: $3}
    }

update_set_list
    : update_set
    {
        $$ = []UpdateSet{$1}
    }
    | update_set ',' update_set_list
    {
        $$ = append([]UpdateSet{$1}, $3...)
    }

replace_query
    : with_clause REPLACE INTO updatable_table_identifier USING '(' field_references ')' VALUES row_values
    {
        $$ = ReplaceQuery{WithClause: $1, Table: Table{Object: $4}, Keys: $7, ValuesList: $10}
    }
    | with_clause REPLACE INTO updatable_table_identifier '(' field_references ')' USING '(' field_references ')' VALUES row_values
    {
        $$ = ReplaceQuery{WithClause: $1, Table: Table{Object: $4}, Fields: $6, Keys: $10, ValuesList: $13}
    }
    | with_clause REPLACE INTO updatable_table_identifier USING '(' field_references ')' select_query
    {
        $$ = ReplaceQuery{WithClause: $1, Table: Table{Object: $4}, Keys: $7, Query: $9.(SelectQuery)}
    }
    | with_clause REPLACE INTO updatable_table_identifier '(' field_references ')' USING '(' field_references ')' select_query
    {
        $$ = ReplaceQuery{WithClause: $1, Table: Table{Object: $4}, Fields: $6, Keys: $10, Query: $12.(SelectQuery)}
    }
    | REPLACE INTO updatable_table_identifier USING '(' field_references ')' VALUES row_values
    {
        $$ = ReplaceQuery{Table: Table{Object: $3}, Keys: $6, ValuesList: $9}
    }
    | REPLACE INTO updatable_table_identifier '(' field_references ')' USING '(' field_references ')' VALUES row_values
    {
        $$ = ReplaceQuery{Table: Table{Object: $3}, Fields: $5, Keys: $9, ValuesList: $12}
    }
    | REPLACE INTO updatable_table_identifier USING '(' field_references ')' select_query
    {
        $$ = ReplaceQuery{Table: Table{Object: $3}, Keys: $6, Query: $8.(SelectQuery)}
    }
    | REPLACE INTO updatable_table_identifier '(' field_references ')' USING '(' field_references ')' select_query
    {
        $$ = ReplaceQuery{Table: Table{Object: $3}, Fields: $5, Keys: $9, Query: $11.(SelectQuery)}
    }

delete_query
    : with_clause DELETE FROM tables where_clause
    {
        $$ = DeleteQuery{BaseExpr: NewBaseExpr($2), WithClause: $1, FromClause: FromClause{Tables: $4}, WhereClause: $5}
    }
    | with_clause DELETE identified_tables FROM tables where_clause
    {
        $$ = DeleteQuery{BaseExpr: NewBaseExpr($2), WithClause: $1, Tables: $3, FromClause: FromClause{Tables: $5}, WhereClause: $6}
    }

elseif
    : ELSEIF substantial_value THEN program
    {
        $$ = []ElseIf{{Condition: $2, Statements: $4}}
    }
    | ELSEIF substantial_value THEN program elseif
    {
        $$ = append([]ElseIf{{Condition: $2, Statements: $4}}, $5...)
    }

else
    :
    {
        $$ = Else{}
    }
    | ELSE program
    {
        $$ = Else{Statements: $2}
    }

in_loop_elseif
    : ELSEIF substantial_value THEN loop_program
    {
        $$ = []ElseIf{{Condition: $2, Statements: $4}}
    }
    | ELSEIF substantial_value THEN loop_program in_loop_elseif
    {
        $$ = append([]ElseIf{{Condition: $2, Statements: $4}}, $5...)
    }

in_loop_else
    :
    {
        $$ = Else{}
    }
    | ELSE loop_program
    {
        $$ = Else{Statements: $2}
    }

in_function_elseif
    : ELSEIF substantial_value THEN function_program
    {
        $$ = []ElseIf{{Condition: $2, Statements: $4}}
    }
    | ELSEIF substantial_value THEN function_program in_function_elseif
    {
        $$ = append([]ElseIf{{Condition: $2, Statements: $4}}, $5...)
    }

in_function_else
    :
    {
        $$ = Else{}
    }
    | ELSE function_program
    {
        $$ = Else{Statements: $2}
    }

in_function_in_loop_elseif
    : ELSEIF substantial_value THEN function_loop_program
    {
        $$ = []ElseIf{{Condition: $2, Statements: $4}}
    }
    | ELSEIF substantial_value THEN function_loop_program in_function_in_loop_elseif
    {
        $$ = append([]ElseIf{{Condition: $2, Statements: $4}}, $5...)
    }

in_function_in_loop_else
    :
    {
        $$ = Else{}
    }
    | ELSE function_loop_program
    {
        $$ = Else{Statements: $2}
    }

case_when
    : WHEN substantial_value THEN program
    {
        $$ = []CaseWhen{{Condition: $2, Statements: $4}}
    }
    | WHEN substantial_value THEN program case_when
    {
        $$ = append([]CaseWhen{{Condition: $2, Statements: $4}}, $5...)
    }

case_else
    :
    {
        $$ = CaseElse{}
    }
    | ELSE program
    {
        $$ = CaseElse{Statements: $2}
    }

in_loop_case_when
    : WHEN substantial_value THEN loop_program
    {
        $$ = []CaseWhen{{Condition: $2, Statements: $4}}
    }
    | WHEN substantial_value THEN loop_program in_loop_case_when
    {
        $$ = append([]CaseWhen{{Condition: $2, Statements: $4}}, $5...)
    }

in_loop_case_else
    :
    {
        $$ = CaseElse{}
    }
    | ELSE loop_program
    {
        $$ = CaseElse{Statements: $2}
    }

in_function_case_when
    : WHEN substantial_value THEN function_program
    {
        $$ = []CaseWhen{{Condition: $2, Statements: $4}}
    }
    | WHEN substantial_value THEN function_program in_function_case_when
    {
        $$ = append([]CaseWhen{{Condition: $2, Statements: $4}}, $5...)
    }

in_function_case_else
    :
    {
        $$ = CaseElse{}
    }
    | ELSE function_program
    {
        $$ = CaseElse{Statements: $2}
    }

in_function_in_loop_case_when
    : WHEN substantial_value THEN function_loop_program
    {
        $$ = []CaseWhen{{Condition: $2, Statements: $4}}
    }
    | WHEN substantial_value THEN function_loop_program in_function_in_loop_case_when
    {
        $$ = append([]CaseWhen{{Condition: $2, Statements: $4}}, $5...)
    }

in_function_in_loop_case_else
    :
    {
        $$ = CaseElse{}
    }
    | ELSE function_loop_program
    {
        $$ = CaseElse{Statements: $2}
    }

identifier
    : IDENTIFIER
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }
    | TIES
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }
    | NULLS
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }
    | ROWS
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }
    | CSV
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }
    | JSON
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }
    | JSONL
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }
    | FIXED
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }
    | LTSV
    {
        $$ = Identifier{BaseExpr: NewBaseExpr($1), Literal: $1.Literal, Quoted: $1.Quoted}
    }

variable
    : VARIABLE
    {
        $$ = Variable{BaseExpr: NewBaseExpr($1), Name:$1.Literal}
    }

variables
    : variable
    {
        $$ = []Variable{$1}
    }
    | variable ',' variables
    {
        $$ = append([]Variable{$1}, $3...)
    }

variable_substitution
    : variable SUBSTITUTION_OP value
    {
        $$ = VariableSubstitution{Variable:$1, Value:$3}
    }

variable_assignment
    : variable
    {
        $$ = VariableAssignment{Variable:$1}
    }
    | variable SUBSTITUTION_OP value
    {
        $$ = VariableAssignment{Variable: $1, Value: $3}
    }

variable_assignments
    : variable_assignment
    {
        $$ = []VariableAssignment{$1}
    }
    | variable_assignment ',' variable_assignments
    {
        $$ = append([]VariableAssignment{$1}, $3...)
    }

environment_variable
    : ENVIRONMENT_VARIABLE
    {
        $$ = EnvironmentVariable{BaseExpr: NewBaseExpr($1), Name: $1.Literal, Quoted: $1.Quoted}
    }

runtime_information
    : RUNTIME_INFORMATION
    {
        $$ = RuntimeInformation{BaseExpr: NewBaseExpr($1), Name: $1.Literal}
    }

constant
    : CONSTANT
    {
        items := strings.Split($1.Literal, ConstantDelimiter)
        space := ""
        if 0 < len(items) {
            space = items[0]
        }
        name := ""
        if 1 < len(items) {
            name = items[1]
        }

        $$ = Constant{BaseExpr: NewBaseExpr($1), Space: space, Name: name}
    }

flag
    : FLAG
    {
        $$ = Flag{BaseExpr: NewBaseExpr($1), Name: $1.Literal}
    }

distinct
    :
    {
        $$ = Token{}
    }
    | DISTINCT
    {
        $$ = $1
    }

negation
    :
    {
        $$ = Token{}
    }
    | NOT
    {
        $$ = $1
    }

join_type_inner
    :
    {
        $$ = Token{}
    }
    | INNER
    {
        $$ = $1
    }

join_type_outer
    :
    {
        $$ = Token{}
    }
    | OUTER
    {
        $$ = $1
    }

join_outer_direction
    : LEFT
    {
        $$ = $1
    }
    | RIGHT
    {
        $$ = $1
    }
    | FULL
    {
        $$ = $1
    }

all
    :
    {
        $$ = Token{}
    }
    | ALL
    {
        $$ = $1
    }

recursive
    :
    {
        $$ = Token{}
    }
    | RECURSIVE
    {
        $$ = $1
    }

as
    :
    {
        $$ = Token{}
    }
    | AS
    {
        $$ = $1
    }

comparison_operator
    : COMPARISON_OP
    {
        $$ = $1
    }
    | '='
    {
        $1.Token = COMPARISON_OP
        $$ = $1
    }

if_not_exists
    :
    {
        $$ = false
    }
    | IF NOT EXISTS
    {
        $$ = true
    }

%%

func SetDebugLevel(level int, verbose bool) {
	yyDebug        = level
	yyErrorVerbose = verbose
}

func Parse(s string, sourceFile string, forPrepared bool, ansiQuotes bool) ([]Statement, int, error) {
    l := new(Lexer)
    l.Init(s, sourceFile, forPrepared, ansiQuotes)
    yyParse(l)
    return l.program, l.HolderNumber(), l.err
}