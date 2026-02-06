

%{
package logfmt

func setScannerData(lex interface{}, data []interface{}) {
    lex.(*Scanner).data = data
}

%}

%union {
    str     string
    key     string
    list    []interface{}
}

%token<str>   STRING
%token<key>   KEY

%type<str>  key value
%type<list> expressions

%%

logfmt:
    expressions  { setScannerData(LogfmtExprlex, $1) }

expressions:
    key                { $$ = []interface{}{$1} }
  | value              { $$ = []interface{}{$1} }
  | expressions value  { $$ = append($1, $2) }
  ;

key:
  KEY     { $$ = $1 }

value:
  STRING    { $$ = $1 }