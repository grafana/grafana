package pattern

%%{
    machine pattern;
    write data;
    access lex.;
    variable p lex.p;
    variable pe lex.pe;
    prepush {
        if len(lex.stack) <= lex.top {
            lex.stack = append(lex.stack, 0)
        }
    }
}%%

%%{
utf8 = (
    0x00..0x7F |
    0xC2..0xDF 0x80..0xBF |
    0xE0 0xA0..0xBF 0x80..0xBF |
    0xE1..0xEC 0x80..0xBF 0x80..0xBF |
    0xED 0x80..0x9F 0x80..0xBF |
    0xEE..0xEF 0x80..0xBF 0x80..0xBF |
    0xF0 0x90..0xBF 0x80..0xBF 0x80..0xBF |
    0xF1..0xF3 0x80..0xBF 0x80..0xBF 0x80..0xBF |
    0xF4 0x80..0x8F 0x80..0xBF 0x80..0xBF
);
}%%

const LEXER_ERROR = 0

%%{
        identifier = '<' (alpha| '_') (alnum | '_' )* '>';
        literal = utf8;
}%%

func (lex *lexer) Lex(out *exprSymType) int {
    eof := lex.pe
    tok := 0

    %%{

        main := |*
            identifier => { tok = lex.handle(lex.identifier(out)); fbreak; };
            literal => { tok = lex.handle(lex.literal(out)); fbreak; };
        *|;

        write exec;
    }%%

    return tok;
}


func (lex *lexer) init() {
    %% write init;
}
