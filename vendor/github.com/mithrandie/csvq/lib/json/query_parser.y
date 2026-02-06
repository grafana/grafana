%{
package json

import "strconv"
%}

%union{
    expression QueryExpression
    element    Element
    field      FieldExpr
    fields     []FieldExpr
    token      QueryToken
}

%type<expression> query
%type<expression> expression
%type<element>    element
%type<element>    single_value_element
%type<expression> array_item
%type<expression> single_value_array_item
%type<expression> row_value
%type<expression> table
%type<field>      field
%type<fields>     fields

%token<token> PATH_IDENTIFIER PATH_INDEX
%token<token> AS

%%

query
    :
    {
        $$ = nil
        jqlex.(*QueryLexer).query = $$
    }
    |  expression
    {
        $$ = $1
        jqlex.(*QueryLexer).query = $$
    }

expression
    :  element
    {
        $$ = $1
    }
    |  array_item
    {
        $$ = $1
    }
    |  row_value
    {
        $$ = $1
    }
    |  table
    {
        $$ = $1
    }

element
    : PATH_IDENTIFIER
    {
        $$ = Element{Label: $1.Literal}
    }
    | PATH_IDENTIFIER '.' element
    {
        $$ = Element{Label: $1.Literal, Child: $3}
    }
    | PATH_IDENTIFIER array_item
    {
        $$ = Element{Label: $1.Literal, Child: $2}
    }
    | PATH_IDENTIFIER row_value
    {
        $$ = Element{Label: $1.Literal, Child: $2}
    }
    | PATH_IDENTIFIER table
    {
        $$ = Element{Label: $1.Literal, Child: $2}
    }

single_value_element
    : PATH_IDENTIFIER
    {
        $$ = Element{Label: $1.Literal}
    }
    | PATH_IDENTIFIER '.' single_value_element
    {
        $$ = Element{Label: $1.Literal, Child: $3}
    }
    | PATH_IDENTIFIER single_value_array_item
    {
        $$ = Element{Label: $1.Literal, Child: $2}
    }

array_item
    : '[' PATH_INDEX ']'
    {
        i, _ := strconv.Atoi($2.Literal)
        $$ = ArrayItem{Index: i}
    }
    | '[' PATH_INDEX ']' '.' element
    {
        i, _ := strconv.Atoi($2.Literal)
        $$ = ArrayItem{Index: i, Child: $5}
    }
    | '[' PATH_INDEX ']' array_item
    {
        i, _ := strconv.Atoi($2.Literal)
        $$ = ArrayItem{Index: i, Child: $4}
    }
    | '[' PATH_INDEX ']' row_value
    {
        i, _ := strconv.Atoi($2.Literal)
        $$ = ArrayItem{Index: i, Child: $4}
    }
    | '[' PATH_INDEX ']' table
    {
        i, _ := strconv.Atoi($2.Literal)
        $$ = ArrayItem{Index: i, Child: $4}
    }

single_value_array_item
    : '[' PATH_INDEX ']'
    {
        i, _ := strconv.Atoi($2.Literal)
        $$ = ArrayItem{Index: i}
    }
    | '[' PATH_INDEX ']' '.' single_value_element
    {
        i, _ := strconv.Atoi($2.Literal)
        $$ = ArrayItem{Index: i, Child: $5}
    }
    | '[' PATH_INDEX ']' single_value_array_item
    {
        i, _ := strconv.Atoi($2.Literal)
        $$ = ArrayItem{Index: i, Child: $4}
    }

row_value
    : '[' ']'
    {
        $$ = RowValueExpr{}
    }
    | '[' ']' '.' single_value_element
    {
        $$ = RowValueExpr{Child: $4}
    }
    | '[' ']' single_value_array_item
    {
        $$ = RowValueExpr{Child: $3}
    }

table
    : '{' fields '}'
    {
        $$ = TableExpr{Fields: $2}
    }

field
    : single_value_element
    {
        $$ = FieldExpr{Element: $1}
    }
    | single_value_element AS PATH_IDENTIFIER
    {
        $$ = FieldExpr{Element: $1, Alias: $3.Literal}
    }

fields
    :
    {
        $$ = nil
    }
    | field
    {
        $$ = []FieldExpr{$1}
    }
    | field ',' fields
    {
        $$ = append([]FieldExpr{$1}, $3...)
    }

%%

func ParseQuery(src string) (QueryExpression, error) {
	l := new(QueryLexer)
	l.Init(src)
	jqParse(l)
	return l.query, l.err
}