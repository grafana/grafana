/*
Copy from https://github.com/freddierice/php_source/blob/467ed5d6edff72219afd3e644516f131118ef48e/ext/json/JSON_parser.c
Base code: Copyright (c) 2005 JSON.org
*/
package internal

type (
	States  int8
	Classes int8
)

const __ = -1

// enum classes
const (
	C_SPACE Classes = iota /* space */
	C_WHITE                /* other whitespace */
	C_LCURB                /* {  */
	C_RCURB                /* } */
	C_LSQRB                /* [ */
	C_RSQRB                /* ] */
	C_COLON                /* : */
	C_COMMA                /* , */
	C_QUOTE                /* " */
	C_BACKS                /* \ */
	C_SLASH                /* / */
	C_PLUS                 /* + */
	C_MINUS                /* - */
	C_POINT                /* . */
	C_ZERO                 /* 0 */
	C_DIGIT                /* 123456789 */
	C_LOW_A                /* a */
	C_LOW_B                /* b */
	C_LOW_C                /* c */
	C_LOW_D                /* d */
	C_LOW_E                /* e */
	C_LOW_F                /* f */
	C_LOW_L                /* l */
	C_LOW_N                /* n */
	C_LOW_R                /* r */
	C_LOW_S                /* s */
	C_LOW_T                /* t */
	C_LOW_U                /* u */
	C_ABCDF                /* ABCDF */
	C_E                    /* E */
	C_ETC                  /* everything else */
)

// AsciiClasses array maps the 128 ASCII characters into character classes.
var AsciiClasses = [128]Classes{
	/*
	   This array maps the 128 ASCII characters into character classes.
	   The remaining Unicode characters should be mapped to C_ETC.
	   Non-whitespace control characters are errors.
	*/
	__, __, __, __, __, __, __, __,
	__, C_WHITE, C_WHITE, __, __, C_WHITE, __, __,
	__, __, __, __, __, __, __, __,
	__, __, __, __, __, __, __, __,

	C_SPACE, C_ETC, C_QUOTE, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC,
	C_ETC, C_ETC, C_ETC, C_PLUS, C_COMMA, C_MINUS, C_POINT, C_SLASH,
	C_ZERO, C_DIGIT, C_DIGIT, C_DIGIT, C_DIGIT, C_DIGIT, C_DIGIT, C_DIGIT,
	C_DIGIT, C_DIGIT, C_COLON, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC,

	C_ETC, C_ABCDF, C_ABCDF, C_ABCDF, C_ABCDF, C_E, C_ABCDF, C_ETC,
	C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC,
	C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC,
	C_ETC, C_ETC, C_ETC, C_LSQRB, C_BACKS, C_RSQRB, C_ETC, C_ETC,

	C_ETC, C_LOW_A, C_LOW_B, C_LOW_C, C_LOW_D, C_LOW_E, C_LOW_F, C_ETC,
	C_ETC, C_ETC, C_ETC, C_ETC, C_LOW_L, C_ETC, C_LOW_N, C_ETC,
	C_ETC, C_ETC, C_LOW_R, C_LOW_S, C_LOW_T, C_LOW_U, C_ETC, C_ETC,
	C_ETC, C_ETC, C_ETC, C_LCURB, C_ETC, C_RCURB, C_ETC, C_ETC,
}

// QuoteAsciiClasses is a HACK for single quote from AsciiClasses
var QuoteAsciiClasses = [128]Classes{
	/*
	   This array maps the 128 ASCII characters into character classes.
	   The remaining Unicode characters should be mapped to C_ETC.
	   Non-whitespace control characters are errors.
	*/
	__, __, __, __, __, __, __, __,
	__, C_WHITE, C_WHITE, __, __, C_WHITE, __, __,
	__, __, __, __, __, __, __, __,
	__, __, __, __, __, __, __, __,

	C_SPACE, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_QUOTE,
	C_ETC, C_ETC, C_ETC, C_PLUS, C_COMMA, C_MINUS, C_POINT, C_SLASH,
	C_ZERO, C_DIGIT, C_DIGIT, C_DIGIT, C_DIGIT, C_DIGIT, C_DIGIT, C_DIGIT,
	C_DIGIT, C_DIGIT, C_COLON, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC,

	C_ETC, C_ABCDF, C_ABCDF, C_ABCDF, C_ABCDF, C_E, C_ABCDF, C_ETC,
	C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC,
	C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC, C_ETC,
	C_ETC, C_ETC, C_ETC, C_LSQRB, C_BACKS, C_RSQRB, C_ETC, C_ETC,

	C_ETC, C_LOW_A, C_LOW_B, C_LOW_C, C_LOW_D, C_LOW_E, C_LOW_F, C_ETC,
	C_ETC, C_ETC, C_ETC, C_ETC, C_LOW_L, C_ETC, C_LOW_N, C_ETC,
	C_ETC, C_ETC, C_LOW_R, C_LOW_S, C_LOW_T, C_LOW_U, C_ETC, C_ETC,
	C_ETC, C_ETC, C_ETC, C_LCURB, C_ETC, C_RCURB, C_ETC, C_ETC,
}

/*
The state codes.
*/
const (
	GO States = iota /* start    */
	OK               /* ok       */
	OB               /* object   */
	KE               /* key      */
	CO               /* colon    */
	VA               /* value    */
	AR               /* array    */
	ST               /* string   */
	ES               /* escape   */
	U1               /* u1       */
	U2               /* u2       */
	U3               /* u3       */
	U4               /* u4       */
	MI               /* minus    */
	ZE               /* zero     */
	IN               /* integer  */
	DT               /* dot      */
	FR               /* fraction */
	E1               /* e        */
	E2               /* ex       */
	E3               /* exp      */
	T1               /* tr       */
	T2               /* tru      */
	T3               /* true     */
	F1               /* fa       */
	F2               /* fal      */
	F3               /* fals     */
	F4               /* false    */
	N1               /* nu       */
	N2               /* nul      */
	N3               /* null     */
)

// List of action codes
const (
	cl States = -2 /* colon           */
	cm States = -3 /* comma           */
	qt States = -4 /* quote           */
	bo States = -5 /* bracket open    */
	co States = -6 /* curly br. open  */
	bc States = -7 /* bracket close   */
	cc States = -8 /* curly br. close */
	ec States = -9 /* curly br. empty */
)

// StateTransitionTable is the state transition table takes the current state and the current symbol, and returns either
// a new state or an action. An action is represented as a negative number. A JSON text is accepted if at the end of the
// text the state is OK and if the mode is DONE.
var StateTransitionTable = [31][31]States{
	/*
	   The state transition table takes the current state and the current symbol,
	   and returns either a new state or an action. An action is represented as a
	   negative number. A JSON text is accepted if at the end of the text the
	   state is OK and if the mode is DONE.
	                  white                                                    1-9                                                ABCDF   etc
	            space   |   {   }   [   ]   :   ,   "   \   /   +   -   .   0   |   a   b   c   d   e   f   l   n   r   s   t   u   |   E   |*/
	/*start  GO*/ {GO, GO, co, __, bo, __, __, __, ST, __, __, __, MI, __, ZE, IN, __, __, __, __, __, F1, __, N1, __, __, T1, __, __, __, __},
	/*ok     OK*/ {OK, OK, __, cc, __, bc, __, cm, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*object OB*/ {OB, OB, __, ec, __, __, __, __, ST, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*key    KE*/ {KE, KE, __, __, __, __, __, __, ST, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*colon  CO*/ {CO, CO, __, __, __, __, cl, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*value  VA*/ {VA, VA, co, __, bo, __, __, __, ST, __, __, __, MI, __, ZE, IN, __, __, __, __, __, F1, __, N1, __, __, T1, __, __, __, __},
	/*array  AR*/ {AR, AR, co, __, bo, bc, __, __, ST, __, __, __, MI, __, ZE, IN, __, __, __, __, __, F1, __, N1, __, __, T1, __, __, __, __},
	/*string ST*/ {ST, __, ST, ST, ST, ST, ST, ST, qt, ES, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST},
	/*escape ES*/ {__, __, __, __, __, __, __, __, ST, ST, ST, __, __, __, __, __, __, ST, __, __, __, ST, __, ST, ST, __, ST, U1, __, __, __},
	/*u1     U1*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, U2, U2, U2, U2, U2, U2, U2, U2, __, __, __, __, __, __, U2, U2, __},
	/*u2     U2*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, U3, U3, U3, U3, U3, U3, U3, U3, __, __, __, __, __, __, U3, U3, __},
	/*u3     U3*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, U4, U4, U4, U4, U4, U4, U4, U4, __, __, __, __, __, __, U4, U4, __},
	/*u4     U4*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, ST, ST, ST, ST, ST, ST, ST, ST, __, __, __, __, __, __, ST, ST, __},
	/*minus  MI*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, ZE, IN, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*zero   ZE*/ {OK, OK, __, cc, __, bc, __, cm, __, __, __, __, __, DT, __, __, __, __, __, __, E1, __, __, __, __, __, __, __, __, E1, __},
	/*int    IN*/ {OK, OK, __, cc, __, bc, __, cm, __, __, __, __, __, DT, IN, IN, __, __, __, __, E1, __, __, __, __, __, __, __, __, E1, __},
	/*dot    DT*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, FR, FR, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*frac   FR*/ {OK, OK, __, cc, __, bc, __, cm, __, __, __, __, __, __, FR, FR, __, __, __, __, E1, __, __, __, __, __, __, __, __, E1, __},
	/*e      E1*/ {__, __, __, __, __, __, __, __, __, __, __, E2, E2, __, E3, E3, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*ex     E2*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, E3, E3, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*exp    E3*/ {OK, OK, __, cc, __, bc, __, cm, __, __, __, __, __, __, E3, E3, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*tr     T1*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, T2, __, __, __, __, __, __},
	/*tru    T2*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, T3, __, __, __},
	/*true   T3*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, OK, __, __, __, __, __, __, __, __, __, __},
	/*fa     F1*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, F2, __, __, __, __, __, __, __, __, __, __, __, __, __, __},
	/*fal    F2*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, F3, __, __, __, __, __, __, __, __},
	/*fals   F3*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, F4, __, __, __, __, __},
	/*false  F4*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, OK, __, __, __, __, __, __, __, __, __, __},
	/*nu     N1*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, N2, __, __, __},
	/*nul    N2*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, N3, __, __, __, __, __, __, __, __},
	/*null   N3*/ {__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, OK, __, __, __, __, __, __, __, __},
}
