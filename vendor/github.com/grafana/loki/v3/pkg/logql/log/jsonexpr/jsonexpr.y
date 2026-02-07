// Inspired by https://github.com/sjjian/yacc-examples

%{
package jsonexpr

func setScannerData(lex interface{}, data []interface{}) {
	lex.(*Scanner).data = data
}

%}

%union {
    empty   struct{}
    str     string
    field   string
    list    []interface{}
    int     int
}

%token<empty>   DOT LSB RSB
%token<str>     STRING
%token<field>   FIELD
%token<int>     INDEX

%type<int>  index index_access
%type<str>  field key key_access
%type<list> values

%%

json:
  values             { setScannerData(JSONExprlex, $1) }

values:
    field                   { $$ = []interface{}{$1} }
  | key_access              { $$ = []interface{}{$1} }
  | index_access            { $$ = []interface{}{$1} }
  | values key_access       { $$ = append($1, $2) }
  | values index_access     { $$ = append($1, $2) }
  | values DOT field        { $$ = append($1, $3) }
  ;

key_access:
    LSB key RSB     { $$ = $2 }

index_access:
    LSB index RSB   { $$ = $2 }

field:
  FIELD             { $$ = $1 }

key:
  STRING            { $$ = $1 }

index:
  INDEX             { $$ = $1 }