%{
package json
%}

%union {
    expression PathExpression
    member     ObjectPath
    token      PathToken
}

%type<expression> path
%type<member>     object_member

%token<token> OBJECT_PATH

%%

path
    :
    {
        $$ = ObjectPath{}
        jplex.(*PathLexer).path = $$
    }
    | object_member
    {
        $$ = $1
        jplex.(*PathLexer).path = $$
    }

object_member
    : OBJECT_PATH
    {
        $$ = ObjectPath{Name: $1.Literal}
    }
    | OBJECT_PATH '.' object_member
    {
        $$ = ObjectPath{Name: $1.Literal, Child: $3}
    }

%%

func ParsePath(src string) (PathExpression, error) {
	l := new(PathLexer)
	l.Init(src)
	jpParse(l)
	return l.path, l.err
}