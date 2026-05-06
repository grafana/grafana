package influxql

import (
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	// DateFormat represents the format for date literals.
	DateFormat = "2006-01-02"

	// DateTimeFormat represents the format for date time literals.
	DateTimeFormat = "2006-01-02 15:04:05.999999"
)

// Parser represents an InfluxQL parser.
type Parser struct {
	s      *bufScanner
	params map[string]Value
}

// NewParser returns a new instance of Parser.
func NewParser(r io.Reader) *Parser {
	return &Parser{s: newBufScanner(r)}
}

// SetParams sets the parameters that will be used for any bound parameter substitutions.
func (p *Parser) SetParams(params map[string]interface{}) {
	p.params = make(map[string]Value, len(params))
	for name, param := range params {
		p.params[name] = BindValue(param)
	}
}

// ParseQuery parses a query string and returns its AST representation.
func ParseQuery(s string) (*Query, error) { return NewParser(strings.NewReader(s)).ParseQuery() }

// ParseStatement parses a statement string and returns its AST representation.
func ParseStatement(s string) (Statement, error) {
	return NewParser(strings.NewReader(s)).ParseStatement()
}

// MustParseStatement parses a statement string and returns its AST. Panic on error.
func MustParseStatement(s string) Statement {
	stmt, err := ParseStatement(s)
	if err != nil {
		panic(err.Error())
	}
	return stmt
}

// ParseExpr parses an expression string and returns its AST representation.
func ParseExpr(s string) (Expr, error) { return NewParser(strings.NewReader(s)).ParseExpr() }

// MustParseExpr parses an expression string and returns its AST. Panic on error.
func MustParseExpr(s string) Expr {
	expr, err := ParseExpr(s)
	if err != nil {
		panic(err.Error())
	}
	return expr
}

// ParseQuery parses an InfluxQL string and returns a Query AST object.
func (p *Parser) ParseQuery() (*Query, error) {
	var statements Statements
	semi := true

	for {
		if tok, pos, lit := p.ScanIgnoreWhitespace(); tok == EOF {
			return &Query{Statements: statements}, nil
		} else if tok == SEMICOLON {
			semi = true
		} else {
			if !semi {
				return nil, newParseError(tokstr(tok, lit), []string{";"}, pos)
			}
			p.Unscan()
			s, err := p.ParseStatement()
			if err != nil {
				return nil, err
			}
			statements = append(statements, s)
			semi = false
		}
	}
}

// ParseStatement parses an InfluxQL string and returns a Statement AST object.
func (p *Parser) ParseStatement() (Statement, error) {
	return Language.Parse(p)
}

// parseSetPasswordUserStatement parses a string and returns a set statement.
// This function assumes the SET token has already been consumed.
func (p *Parser) parseSetPasswordUserStatement() (*SetPasswordUserStatement, error) {
	stmt := &SetPasswordUserStatement{}

	// Parse username
	ident, err := p.ParseIdent()

	if err != nil {
		return nil, err
	}
	stmt.Name = ident

	// Consume the required = token.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != EQ {
		return nil, newParseError(tokstr(tok, lit), []string{"="}, pos)
	}

	// Parse new user's password
	if ident, err = p.parseString(); err != nil {
		return nil, err
	}
	stmt.Password = ident

	return stmt, nil
}

// parseKillQueryStatement parses a string and returns a kill statement.
// This function assumes the KILL token has already been consumed.
func (p *Parser) parseKillQueryStatement() (*KillQueryStatement, error) {
	qid, err := p.ParseUInt64()
	if err != nil {
		return nil, err
	}

	var host string
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		host, err = p.ParseIdent()
		if err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}
	return &KillQueryStatement{QueryID: qid, Host: host}, nil
}

// parseCreateSubscriptionStatement parses a string and returns a CreateSubscriptionStatement.
// This function assumes the "CREATE SUBSCRIPTION" tokens have already been consumed.
func (p *Parser) parseCreateSubscriptionStatement() (*CreateSubscriptionStatement, error) {
	stmt := &CreateSubscriptionStatement{}

	// Read the id of the subscription to create.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = ident

	// Expect an "ON" keyword.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != ON {
		return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
	}

	// Read the name of the database.
	if ident, err = p.ParseIdent(); err != nil {
		return nil, err
	}
	stmt.Database = ident

	if tok, pos, lit := p.Scan(); tok != DOT {
		return nil, newParseError(tokstr(tok, lit), []string{"."}, pos)
	}

	// Read the name of the retention policy.
	if ident, err = p.ParseIdent(); err != nil {
		return nil, err
	}
	stmt.RetentionPolicy = ident

	// Expect a "DESTINATIONS" keyword.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != DESTINATIONS {
		return nil, newParseError(tokstr(tok, lit), []string{"DESTINATIONS"}, pos)
	}

	// Expect one of "ANY ALL" keywords.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok == ALL || tok == ANY {
		stmt.Mode = tokens[tok]
	} else {
		return nil, newParseError(tokstr(tok, lit), []string{"ALL", "ANY"}, pos)
	}

	// Read list of destinations.
	var destinations []string
	if destinations, err = p.parseStringList(); err != nil {
		return nil, err
	}
	stmt.Destinations = destinations

	return stmt, nil
}

// parseCreateRetentionPolicyStatement parses a string and returns a create retention policy statement.
// This function assumes the CREATE RETENTION POLICY tokens have already been consumed.
func (p *Parser) parseCreateRetentionPolicyStatement() (*CreateRetentionPolicyStatement, error) {
	stmt := &CreateRetentionPolicyStatement{}

	// Parse the retention policy name.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = ident

	// Consume the required ON token.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != ON {
		return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
	}

	// Parse the database name.
	ident, err = p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Database = ident

	// Parse required DURATION token.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != DURATION {
		return nil, newParseError(tokstr(tok, lit), []string{"DURATION"}, pos)
	}

	// Parse duration value
	d, err := p.ParseDuration()
	if err != nil {
		return nil, err
	}
	stmt.Duration = d

	// Parse required REPLICATION token.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != REPLICATION {
		return nil, newParseError(tokstr(tok, lit), []string{"REPLICATION"}, pos)
	}

	// Parse replication value.
	n, err := p.ParseInt(1, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	stmt.Replication = n

	// Parse optional SHARD token.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == SHARD {
		if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != DURATION {
			return nil, newParseError(tokstr(tok, lit), []string{"DURATION"}, pos)
		}

		// Check to see if they used the INF keyword
		tok, pos, _ := p.ScanIgnoreWhitespace()
		if tok == INF {
			return nil, &ParseError{
				Message: "invalid duration INF for shard duration",
				Pos:     pos,
			}
		}
		p.Unscan()

		d, err := p.ParseDuration()
		if err != nil {
			return nil, err
		}
		stmt.ShardGroupDuration = d
	} else {
		p.Unscan()
	}

	// Parse optional DEFAULT token.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == DEFAULT {
		stmt.Default = true
	} else {
		p.Unscan()
	}
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FUTURE {
		d, err := p.parseWriteLimit()
		if err != nil {
			return nil, err
		}
		stmt.FutureWriteLimit = d
	} else {
		p.Unscan()
	}
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == PAST {
		d, err := p.parseWriteLimit()
		if err != nil {
			return nil, err
		}
		stmt.PastWriteLimit = d
	} else {
		p.Unscan()
	}
	return stmt, nil
}

// parseAlterRetentionPolicyStatement parses a string and returns an alter retention policy statement.
// This function assumes the ALTER RETENTION POLICY tokens have already been consumed.
func (p *Parser) parseAlterRetentionPolicyStatement() (*AlterRetentionPolicyStatement, error) {
	stmt := &AlterRetentionPolicyStatement{}

	// Parse the retention policy name.
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok == DEFAULT {
		stmt.Name = "default"
	} else if tok == IDENT {
		stmt.Name = lit
	} else {
		return nil, newParseError(tokstr(tok, lit), []string{"identifier"}, pos)
	}

	// Consume the required ON token.
	if tok, pos, lit = p.ScanIgnoreWhitespace(); tok != ON {
		return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
	}

	// Parse the database name.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Database = ident

	// Loop through option tokens (DURATION, REPLICATION, SHARD DURATION, DEFAULT, etc.).
	found := make(map[Token]struct{})
Loop:
	for {
		tok, pos, lit := p.ScanIgnoreWhitespace()
		if _, ok := found[tok]; ok {
			return nil, &ParseError{
				Message: fmt.Sprintf("found duplicate %s option", tok),
				Pos:     pos,
			}
		}

		switch tok {
		case DURATION:
			d, err := p.ParseDuration()
			if err != nil {
				return nil, err
			}
			stmt.Duration = &d
		case REPLICATION:
			n, err := p.ParseInt(1, math.MaxInt32)
			if err != nil {
				return nil, err
			}
			stmt.Replication = &n
		case SHARD:
			tok, pos, lit := p.ScanIgnoreWhitespace()
			if tok == DURATION {
				// Check to see if they used the INF keyword
				tok, pos, _ := p.ScanIgnoreWhitespace()
				if tok == INF {
					return nil, &ParseError{
						Message: "invalid duration INF for shard duration",
						Pos:     pos,
					}
				}
				p.Unscan()

				d, err := p.ParseDuration()
				if err != nil {
					return nil, err
				}
				stmt.ShardGroupDuration = &d
			} else {
				return nil, newParseError(tokstr(tok, lit), []string{"DURATION"}, pos)
			}
		case DEFAULT:
			stmt.Default = true
		case FUTURE:
			d, err := p.parseWriteLimit()
			if err != nil {
				return nil, err
			}
			stmt.FutureWriteLimit = &d
		case PAST:
			d, err := p.parseWriteLimit()
			if err != nil {
				return nil, err
			}
			stmt.PastWriteLimit = &d
		default:
			if len(found) == 0 {
				return nil, newParseError(tokstr(tok, lit), []string{"DURATION", "REPLICATION", "SHARD", "DEFAULT", "FUTURE", "PAST"}, pos)
			}
			p.Unscan()
			break Loop
		}
		found[tok] = struct{}{}
	}

	return stmt, nil
}

// Parses the "LIMIT <duration> from a "FUTURE LIMIT <duration>"
// or "PAST LIMIT <duration>" statement.
func (p *Parser) parseWriteLimit() (time.Duration, error) {
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok == LIMIT {
		d, err := p.ParseDuration()
		if err != nil {
			return 0, err
		}
		return d, nil
	} else {
		return 0, newParseError(tokstr(tok, lit), []string{"LIMIT"}, pos)
	}
}

// ParseInt parses a string representing a base 10 integer and returns the number.
// It returns an error if the parsed number is outside the range [min, max].
func (p *Parser) ParseInt(min, max int) (int, error) {
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok != INTEGER {
		return 0, newParseError(tokstr(tok, lit), []string{"integer"}, pos)
	}

	// Convert string to int.
	n, err := strconv.Atoi(lit)
	if err != nil {
		return 0, &ParseError{Message: err.Error(), Pos: pos}
	} else if min > n || n > max {
		return 0, &ParseError{
			Message: fmt.Sprintf("invalid value %d: must be %d <= n <= %d", n, min, max),
			Pos:     pos,
		}
	}

	return n, nil
}

// ParseUInt64 parses a string and returns a 64-bit unsigned integer literal.
func (p *Parser) ParseUInt64() (uint64, error) {
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok != INTEGER {
		return 0, newParseError(tokstr(tok, lit), []string{"integer"}, pos)
	}

	// Convert string to unsigned 64-bit integer
	n, err := strconv.ParseUint(lit, 10, 64)
	if err != nil {
		return 0, &ParseError{Message: err.Error(), Pos: pos}
	}

	return uint64(n), nil
}

// ParseDuration parses a string and returns a duration literal.
// This function assumes the DURATION token has already been consumed.
func (p *Parser) ParseDuration() (time.Duration, error) {
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok != DURATIONVAL && tok != INF {
		return 0, newParseError(tokstr(tok, lit), []string{"duration"}, pos)
	}

	if tok == INF {
		return 0, nil
	}

	d, err := ParseDuration(lit)
	if err != nil {
		return 0, &ParseError{Message: err.Error(), Pos: pos}
	}

	return d, nil
}

// ParseIdent parses an identifier.
func (p *Parser) ParseIdent() (string, error) {
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok != IDENT {
		return "", newParseError(tokstr(tok, lit), []string{"identifier"}, pos)
	}
	return lit, nil
}

// ParseIdentList parses a comma delimited list of identifiers.
func (p *Parser) ParseIdentList() ([]string, error) {
	// Parse first (required) identifier.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	idents := []string{ident}

	// Parse remaining (optional) identifiers.
	for {
		if tok, _, _ := p.ScanIgnoreWhitespace(); tok != COMMA {
			p.Unscan()
			return idents, nil
		}

		if ident, err = p.ParseIdent(); err != nil {
			return nil, err
		}

		idents = append(idents, ident)
	}
}

// parseSegmentedIdents parses a segmented identifiers.
// e.g.,  "db"."rp".measurement  or  "db"..measurement
func (p *Parser) parseSegmentedIdents() ([]string, error) {
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	idents := []string{ident}

	// Parse remaining (optional) identifiers.
	for {
		if tok, _, _ := p.Scan(); tok != DOT {
			// No more segments so we're done.
			p.Unscan()
			break
		}

		if ch := p.peekRune(); ch == '/' {
			// Next segment is a regex so we're done.
			break
		} else if ch == ':' {
			// Next segment is context-specific so let caller handle it.
			break
		} else if ch == '.' {
			// Add an empty identifier.
			idents = append(idents, "")
			continue
		}

		// Parse the next identifier.
		if ident, err = p.ParseIdent(); err != nil {
			return nil, err
		}

		idents = append(idents, ident)
	}

	if len(idents) > 3 {
		msg := fmt.Sprintf("too many segments in %s", QuoteIdent(idents...))
		return nil, &ParseError{Message: msg}
	}

	return idents, nil
}

// parseString parses a string.
func (p *Parser) parseString() (string, error) {
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok != STRING {
		return "", newParseError(tokstr(tok, lit), []string{"string"}, pos)
	}
	return lit, nil
}

// parseStringList parses a list of strings separated by commas.
func (p *Parser) parseStringList() ([]string, error) {
	// Parse first (required) string.
	str, err := p.parseString()
	if err != nil {
		return nil, err
	}
	strs := []string{str}

	// Parse remaining (optional) strings.
	for {
		if tok, _, _ := p.ScanIgnoreWhitespace(); tok != COMMA {
			p.Unscan()
			return strs, nil
		}

		if str, err = p.parseString(); err != nil {
			return nil, err
		}

		strs = append(strs, str)
	}
}

// parseRevokeStatement parses a string and returns a revoke statement.
// This function assumes the REVOKE token has already been consumed.
func (p *Parser) parseRevokeStatement() (Statement, error) {
	// Parse the privilege to be revoked.
	priv, err := p.parsePrivilege()
	if err != nil {
		return nil, err
	}

	// Check for ON or FROM clauses.
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok == ON {
		stmt, err := p.parseRevokeOnStatement()
		if err != nil {
			return nil, err
		}
		stmt.Privilege = priv
		return stmt, nil
	} else if tok == FROM {
		// Admin privilege is only revoked on ALL PRIVILEGES.
		if priv != AllPrivileges {
			return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
		}
		return p.parseRevokeAdminStatement()
	}

	// Only ON or FROM clauses are allowed after privilege.
	if priv == AllPrivileges {
		return nil, newParseError(tokstr(tok, lit), []string{"ON", "FROM"}, pos)
	}
	return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
}

// parseRevokeOnStatement parses a string and returns a revoke statement.
// This function assumes the [PRIVILEGE] ON tokens have already been consumed.
func (p *Parser) parseRevokeOnStatement() (*RevokeStatement, error) {
	stmt := &RevokeStatement{}

	// Parse the name of the database.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.On = lit

	// Parse FROM clause.
	tok, pos, lit := p.ScanIgnoreWhitespace()

	// Check for required FROM token.
	if tok != FROM {
		return nil, newParseError(tokstr(tok, lit), []string{"FROM"}, pos)
	}

	// Parse the name of the user.
	lit, err = p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.User = lit

	return stmt, nil
}

// parseRevokeAdminStatement parses a string and returns a revoke admin statement.
// This function assumes the ALL [PRVILEGES] FROM token has already been consumed.
func (p *Parser) parseRevokeAdminStatement() (*RevokeAdminStatement, error) {
	// Admin privilege is always false when revoke admin clause is called.
	stmt := &RevokeAdminStatement{}

	// Parse the name of the user.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.User = lit

	return stmt, nil
}

// parseGrantStatement parses a string and returns a grant statement.
// This function assumes the GRANT token has already been consumed.
func (p *Parser) parseGrantStatement() (Statement, error) {
	// Parse the privilege to be granted.
	priv, err := p.parsePrivilege()
	if err != nil {
		return nil, err
	}

	// Check for ON or TO clauses.
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok == ON {
		stmt, err := p.parseGrantOnStatement()
		if err != nil {
			return nil, err
		}
		stmt.Privilege = priv
		return stmt, nil
	} else if tok == TO {
		// Admin privilege is only granted on ALL PRIVILEGES.
		if priv != AllPrivileges {
			return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
		}
		return p.parseGrantAdminStatement()
	}

	// Only ON or TO clauses are allowed after privilege.
	if priv == AllPrivileges {
		return nil, newParseError(tokstr(tok, lit), []string{"ON", "TO"}, pos)
	}
	return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
}

// parseGrantOnStatement parses a string and returns a grant statement.
// This function assumes the [PRIVILEGE] ON tokens have already been consumed.
func (p *Parser) parseGrantOnStatement() (*GrantStatement, error) {
	stmt := &GrantStatement{}

	// Parse the name of the database.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.On = lit

	// Parse TO clause.
	tok, pos, lit := p.ScanIgnoreWhitespace()

	// Check for required TO token.
	if tok != TO {
		return nil, newParseError(tokstr(tok, lit), []string{"TO"}, pos)
	}

	// Parse the name of the user.
	lit, err = p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.User = lit

	return stmt, nil
}

// parseGrantAdminStatement parses a string and returns a grant admin statement.
// This function assumes the ALL [PRVILEGES] TO tokens have already been consumed.
func (p *Parser) parseGrantAdminStatement() (*GrantAdminStatement, error) {
	// Admin privilege is always true when grant admin clause is called.
	stmt := &GrantAdminStatement{}

	// Parse the name of the user.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.User = lit

	return stmt, nil
}

// parsePrivilege parses a string and returns a Privilege.
func (p *Parser) parsePrivilege() (Privilege, error) {
	tok, pos, lit := p.ScanIgnoreWhitespace()
	switch tok {
	case READ:
		return ReadPrivilege, nil
	case WRITE:
		return WritePrivilege, nil
	case ALL:
		// Consume optional PRIVILEGES token
		tok, pos, lit = p.ScanIgnoreWhitespace()
		if tok != PRIVILEGES {
			p.Unscan()
		}
		return AllPrivileges, nil
	}
	return 0, newParseError(tokstr(tok, lit), []string{"READ", "WRITE", "ALL [PRIVILEGES]"}, pos)
}

// parseSelectStatement parses a select string and returns a Statement AST object.
// This function assumes the SELECT token has already been consumed.
func (p *Parser) parseSelectStatement(tr targetRequirement) (*SelectStatement, error) {
	stmt := &SelectStatement{}
	var err error

	// Parse fields: "FIELD+".
	if stmt.Fields, err = p.parseFields(); err != nil {
		return nil, err
	}

	// Parse target: "INTO"
	if stmt.Target, err = p.parseTarget(tr); err != nil {
		return nil, err
	}

	// Parse source: "FROM".
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != FROM {
		return nil, newParseError(tokstr(tok, lit), []string{"FROM"}, pos)
	}
	if stmt.Sources, err = p.parseSources(true); err != nil {
		return nil, err
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse dimensions: "GROUP BY DIMENSION+".
	if stmt.Dimensions, err = p.parseDimensions(); err != nil {
		return nil, err
	}

	// Parse fill options: "fill(<option>)"
	if stmt.Fill, stmt.FillValue, err = p.parseFill(); err != nil {
		return nil, err
	}

	// Parse sort: "ORDER BY FIELD+".
	if stmt.SortFields, err = p.parseOrderBy(); err != nil {
		return nil, err
	}

	// Parse limit: "LIMIT <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	}

	// Parse offset: "OFFSET <n>".
	if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	// Parse series limit: "SLIMIT <n>".
	if stmt.SLimit, err = p.ParseOptionalTokenAndInt(SLIMIT); err != nil {
		return nil, err
	}

	// Parse series offset: "SOFFSET <n>".
	if stmt.SOffset, err = p.ParseOptionalTokenAndInt(SOFFSET); err != nil {
		return nil, err
	}

	// Parse timezone: "TZ(<timezone>)".
	if stmt.Location, err = p.parseLocation(); err != nil {
		return nil, err
	}

	// Set if the query is a raw data query or one with an aggregate
	stmt.IsRawQuery = true
	WalkFunc(stmt.Fields, func(n Node) {
		if _, ok := n.(*Call); ok {
			stmt.IsRawQuery = false
		}
	})

	return stmt, nil
}

// targetRequirement specifies whether or not a target clause is required.
type targetRequirement int

const (
	targetRequired targetRequirement = iota
	targetNotRequired
	targetSubquery
)

// parseTarget parses a string and returns a Target.
func (p *Parser) parseTarget(tr targetRequirement) (*Target, error) {
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != INTO {
		if tr == targetRequired {
			return nil, newParseError(tokstr(tok, lit), []string{"INTO"}, pos)
		}
		p.Unscan()
		return nil, nil
	}

	// db, rp, and / or measurement
	idents, err := p.parseSegmentedIdents()
	if err != nil {
		return nil, err
	}

	if len(idents) < 3 {
		// Check for source measurement reference.
		if ch := p.peekRune(); ch == ':' {
			if err := p.parseTokens([]Token{COLON, MEASUREMENT}); err != nil {
				return nil, err
			}
			// Append empty measurement name.
			idents = append(idents, "")
		}
	}

	t := &Target{Measurement: &Measurement{IsTarget: true}}

	switch len(idents) {
	case 1:
		t.Measurement.Name = idents[0]
	case 2:
		t.Measurement.RetentionPolicy = idents[0]
		t.Measurement.Name = idents[1]
	case 3:
		t.Measurement.Database = idents[0]
		t.Measurement.RetentionPolicy = idents[1]
		t.Measurement.Name = idents[2]
	}

	return t, nil
}

// parseDeleteStatement parses a string and returns a delete statement.
// This function assumes the DELETE token has already been consumed.
func (p *Parser) parseDeleteStatement() (Statement, error) {
	stmt := &DeleteSeriesStatement{}
	var err error

	tok, pos, lit := p.ScanIgnoreWhitespace()

	if tok == FROM {
		// Parse source.
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}

		var err error
		WalkFunc(stmt.Sources, func(n Node) {
			if t, ok := n.(*Measurement); ok {
				// Don't allow database or retention policy in from clause for delete
				// statement. They apply across selected database.
				if t.Database != "" {
					err = &ParseError{Message: "database not supported"}
				}
			}
		})
		if err != nil {
			return nil, err
		}

	} else {
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// If they didn't provide a FROM or a WHERE, this query is invalid
	if stmt.Condition == nil && stmt.Sources == nil {
		return nil, newParseError(tokstr(tok, lit), []string{"FROM", "WHERE"}, pos)
	}

	return stmt, nil
}

// parseShowSeriesStatement parses a string and returns a Statement.
// This function assumes the "SHOW SERIES" tokens have already been consumed.
func (p *Parser) parseShowSeriesStatement() (Statement, error) {
	var exactCardinality bool
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == EXACT {
		exactCardinality = true
	} else {
		p.Unscan()
	}

	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == CARDINALITY {
		return p.parseShowSeriesCardinalityStatement(exactCardinality)
	}
	p.Unscan()

	// Handle SHOW SERIES statments.

	stmt := &ShowSeriesStatement{}
	var err error

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		// Parse the database.
		stmt.Database, err = p.ParseIdent()
		if err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional FROM.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse sort: "ORDER BY FIELD+".
	if stmt.SortFields, err = p.parseOrderBy(); err != nil {
		return nil, err
	}

	// Parse limit: "LIMIT <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	}

	// Parse offset: "OFFSET <n>".
	if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// This function assumes the "SHOW SERIES EXACT CARDINALITY" or the
// "SHOW SERIES CARDINALITY" tokens have already been consumed.
func (p *Parser) parseShowSeriesCardinalityStatement(exact bool) (Statement, error) {
	var err error
	stmt := &ShowSeriesCardinalityStatement{Exact: exact}

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		if stmt.Database, err = p.ParseIdent(); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional FROM.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse dimensions: "GROUP BY DIMENSION+".
	if stmt.Dimensions, err = p.parseDimensions(); err != nil {
		return nil, err
	}

	// Parse limit & offset: "LIMIT <n>", "OFFSET <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	} else if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// This function assumes the "SHOW MEASUREMENT" tokens have already been consumed.
func (p *Parser) parseShowMeasurementCardinalityStatement(exact bool) (Statement, error) {
	stmt := &ShowMeasurementCardinalityStatement{Exact: exact}

	if stmt.Exact {
		// Parse remaining CARDINALITY token
		if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != CARDINALITY {
			return nil, newParseError(tokstr(tok, lit), []string{"CARDINALITY"}, pos)
		}
	}

	// Parse optional ON clause.
	var err error
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		if stmt.Database, err = p.ParseIdent(); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional FROM.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse dimensions: "GROUP BY DIMENSION+".
	if stmt.Dimensions, err = p.parseDimensions(); err != nil {
		return nil, err
	}

	// Parse limit & offset: "LIMIT <n>", "OFFSET <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	} else if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseShowMeasurementsStatement parses a string and returns a Statement.
// This function assumes the "SHOW MEASUREMENTS" tokens have already been consumed.
func (p *Parser) parseShowMeasurementsStatement() (*ShowMeasurementsStatement, error) {
	stmt := &ShowMeasurementsStatement{}
	var err error

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		// Parse the database.
		tok, pos, lit := p.ScanIgnoreWhitespace()
		if tok == IDENT {
			stmt.Database = lit
		} else if tok == MUL {
			stmt.WildcardDatabase = true
		} else {
			return nil, newParseError(tokstr(tok, lit), []string{"identifier or *"}, pos)
		}

		if tok, _, _ := p.ScanIgnoreWhitespace(); tok == DOT {
			tok, pos, lit := p.ScanIgnoreWhitespace()
			if tok == IDENT {
				stmt.RetentionPolicy = lit
			} else if tok == MUL {
				stmt.WildcardRetentionPolicy = true
			} else {
				return nil, newParseError(tokstr(tok, lit), []string{"identifier or *"}, pos)
			}
		} else {
			p.Unscan()
		}
	} else {
		p.Unscan()
	}

	// Parse optional WITH clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == WITH {
		// Parse required MEASUREMENT token.
		if err := p.parseTokens([]Token{MEASUREMENT}); err != nil {
			return nil, err
		}

		// Parse required operator: = or =~.
		tok, pos, lit := p.ScanIgnoreWhitespace()
		switch tok {
		case EQ, EQREGEX:
			// Parse required source (measurement name or regex).
			if stmt.Source, err = p.parseSource(false); err != nil {
				return nil, err
			}
		default:
			return nil, newParseError(tokstr(tok, lit), []string{"=", "=~"}, pos)
		}
	} else {
		// Not a WITH clause so put the token back.
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse sort: "ORDER BY FIELD+".
	if stmt.SortFields, err = p.parseOrderBy(); err != nil {
		return nil, err
	}

	// Parse limit: "LIMIT <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	}

	// Parse offset: "OFFSET <n>".
	if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseShowQueriesStatement parses a string and returns a ShowQueriesStatement.
// This function assumes the "SHOW QUERIES" tokens have been consumed.
func (p *Parser) parseShowQueriesStatement() (*ShowQueriesStatement, error) {
	return &ShowQueriesStatement{}, nil
}

// parseShowRetentionPoliciesStatement parses a string and returns a ShowRetentionPoliciesStatement.
// This function assumes the "SHOW RETENTION POLICIES" tokens have been consumed.
func (p *Parser) parseShowRetentionPoliciesStatement() (*ShowRetentionPoliciesStatement, error) {
	stmt := &ShowRetentionPoliciesStatement{}

	// Expect an "ON" keyword.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		// Parse the database.
		ident, err := p.ParseIdent()
		if err != nil {
			return nil, err
		}
		stmt.Database = ident
	} else {
		p.Unscan()
	}

	return stmt, nil
}

// This function assumes the "SHOW TAG KEY" tokens have already been consumed.
func (p *Parser) parseShowTagKeyCardinalityStatement() (Statement, error) {
	var err error
	var exactCardinality bool
	requiredTokens := []string{"EXACT", "CARDINALITY"}
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == EXACT {
		exactCardinality = true
		requiredTokens = requiredTokens[1:]
	} else {
		p.Unscan()
	}

	stmt := &ShowTagKeyCardinalityStatement{Exact: exactCardinality}

	// Parse remaining CARDINALITY token
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != CARDINALITY {
		return nil, newParseError(tokstr(tok, lit), requiredTokens, pos)
	}

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		if stmt.Database, err = p.ParseIdent(); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional FROM.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse dimensions: "GROUP BY DIMENSION+".
	if stmt.Dimensions, err = p.parseDimensions(); err != nil {
		return nil, err
	}

	// Parse limit & offset: "LIMIT <n>", "OFFSET <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	} else if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseShowTagKeysStatement parses a string and returns a Statement.
// This function assumes the "SHOW TAG KEYS" tokens have already been consumed.
func (p *Parser) parseShowTagKeysStatement() (*ShowTagKeysStatement, error) {
	stmt := &ShowTagKeysStatement{}
	var err error

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		// Parse the database.
		stmt.Database, err = p.ParseIdent()
		if err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional source.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional WITH clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == WITH {
		p.Unscan()
		if stmt.TagKeyOp, stmt.TagKeyExpr, err = p.parseTagKeyExpr(); err != nil {
			return nil, err
		}
	} else {
		// Not a WITH clause so put the token back.
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse sort: "ORDER BY FIELD+".
	if stmt.SortFields, err = p.parseOrderBy(); err != nil {
		return nil, err
	}

	// Parse limit: "LIMIT <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	}

	// Parse offset: "OFFSET <n>".
	if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	// Parse series limit: "SLIMIT <n>".
	if stmt.SLimit, err = p.ParseOptionalTokenAndInt(SLIMIT); err != nil {
		return nil, err
	}

	// Parse series offset: "SOFFSET <n>".
	if stmt.SOffset, err = p.ParseOptionalTokenAndInt(SOFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseShowTagValuesStatement parses a string and returns a Statement.
// This function assumes the "SHOW TAG VALUES" tokens have already been consumed.
func (p *Parser) parseShowTagValuesStatement() (Statement, error) {
	stmt := &ShowTagValuesStatement{}
	var err error

	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == EXACT {
		return p.parseShowTagValuesCardinalityStatement(true)
	} else if tok == CARDINALITY {
		return p.parseShowTagValuesCardinalityStatement(false)
	}
	p.Unscan()

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		// Parse the database.
		stmt.Database, err = p.ParseIdent()
		if err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional source.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse required WITH KEY.
	if stmt.Op, stmt.TagKeyExpr, err = p.parseTagKeyExpr(); err != nil {
		return nil, err
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse sort: "ORDER BY FIELD+".
	if stmt.SortFields, err = p.parseOrderBy(); err != nil {
		return nil, err
	}

	// Parse limit: "LIMIT <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	}

	// Parse offset: "OFFSET <n>".
	if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// This function assumes the "SHOW TAG VALUES" tokens have already been consumed.
func (p *Parser) parseShowTagValuesCardinalityStatement(exact bool) (Statement, error) {
	var err error
	stmt := &ShowTagValuesCardinalityStatement{Exact: exact}

	if stmt.Exact {
		// Parse remaining CARDINALITY token
		if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != CARDINALITY {
			return nil, newParseError(tokstr(tok, lit), []string{"CARDINALITY"}, pos)
		}
	}

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		if stmt.Database, err = p.ParseIdent(); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional FROM.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse required WITH KEY.
	if stmt.Op, stmt.TagKeyExpr, err = p.parseTagKeyExpr(); err != nil {
		return nil, err
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse dimensions: "GROUP BY DIMENSION+".
	if stmt.Dimensions, err = p.parseDimensions(); err != nil {
		return nil, err
	}

	// Parse limit & offset: "LIMIT <n>", "OFFSET <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	} else if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseTagKeys parses a string and returns a list of tag keys.
func (p *Parser) parseTagKeyExpr() (Token, Literal, error) {
	var err error

	// Parse required WITH KEY tokens.
	if err := p.parseTokens([]Token{WITH, KEY}); err != nil {
		return 0, nil, err
	}

	// Parse required IN, EQ, or EQREGEX token.
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok == IN {
		// Parse required ( token.
		if tok, pos, lit = p.ScanIgnoreWhitespace(); tok != LPAREN {
			return 0, nil, newParseError(tokstr(tok, lit), []string{"("}, pos)
		}

		// Parse tag key list.
		var tagKeys []string
		if tagKeys, err = p.ParseIdentList(); err != nil {
			return 0, nil, err
		}

		// Parse required ) token.
		if tok, pos, lit = p.ScanIgnoreWhitespace(); tok != RPAREN {
			return 0, nil, newParseError(tokstr(tok, lit), []string{")"}, pos)
		}
		return IN, &ListLiteral{Vals: tagKeys}, nil
	} else if tok == EQ || tok == NEQ {
		// Parse required tag key.
		ident, err := p.ParseIdent()
		if err != nil {
			return 0, nil, err
		}
		return tok, &StringLiteral{Val: ident}, nil
	} else if tok == EQREGEX || tok == NEQREGEX {
		re, err := p.parseRegex()
		if err != nil {
			return 0, nil, err
		} else if re == nil {
			// parseRegex can return an empty type, but we need it to be present
			tok, pos, lit := p.ScanIgnoreWhitespace()
			return 0, nil, newParseError(tokstr(tok, lit), []string{"regex"}, pos)
		}
		return tok, re, nil
	}
	return 0, nil, newParseError(tokstr(tok, lit), []string{"IN", "=", "=~"}, pos)
}

// parseShowUsersStatement parses a string and returns a ShowUsersStatement.
// This function assumes the "SHOW USERS" tokens have been consumed.
func (p *Parser) parseShowUsersStatement() (*ShowUsersStatement, error) {
	return &ShowUsersStatement{}, nil
}

// parseShowSubscriptionsStatement parses a string and returns a ShowSubscriptionsStatement
// This function assumes the "SHOW SUBSCRIPTIONS" tokens have been consumed.
func (p *Parser) parseShowSubscriptionsStatement() (*ShowSubscriptionsStatement, error) {
	stmt := &ShowSubscriptionsStatement{}
	return stmt, nil
}

// This function assumes the "SHOW FIELD KEY" tokens have already been consumed.
func (p *Parser) parseShowFieldKeyCardinalityStatement() (Statement, error) {
	var err error
	var exactCardinality bool
	requiredTokens := []string{"EXACT", "CARDINALITY"}
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == EXACT {
		exactCardinality = true
		requiredTokens = requiredTokens[1:]
	} else {
		p.Unscan()
	}

	stmt := &ShowFieldKeyCardinalityStatement{Exact: exactCardinality}

	// Parse remaining CARDINALITY token
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != CARDINALITY {
		return nil, newParseError(tokstr(tok, lit), requiredTokens, pos)
	}

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		if stmt.Database, err = p.ParseIdent(); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional FROM.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// Parse dimensions: "GROUP BY DIMENSION+".
	if stmt.Dimensions, err = p.parseDimensions(); err != nil {
		return nil, err
	}

	// Parse limit & offset: "LIMIT <n>", "OFFSET <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	} else if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseShowFieldKeysStatement parses a string and returns a Statement.
// This function assumes the "SHOW FIELD KEYS" tokens have already been consumed.
func (p *Parser) parseShowFieldKeysStatement() (*ShowFieldKeysStatement, error) {
	stmt := &ShowFieldKeysStatement{}
	var err error

	// Parse optional ON clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ON {
		// Parse the database.
		stmt.Database, err = p.ParseIdent()
		if err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse optional source.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FROM {
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse sort: "ORDER BY FIELD+".
	if stmt.SortFields, err = p.parseOrderBy(); err != nil {
		return nil, err
	}

	// Parse limit: "LIMIT <n>".
	if stmt.Limit, err = p.ParseOptionalTokenAndInt(LIMIT); err != nil {
		return nil, err
	}

	// Parse offset: "OFFSET <n>".
	if stmt.Offset, err = p.ParseOptionalTokenAndInt(OFFSET); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseDropMeasurementStatement parses a string and returns a DropMeasurementStatement.
// This function assumes the "DROP MEASUREMENT" tokens have already been consumed.
func (p *Parser) parseDropMeasurementStatement() (*DropMeasurementStatement, error) {
	stmt := &DropMeasurementStatement{}

	// Parse the name of the measurement to be dropped.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = lit

	return stmt, nil
}

// parseDropSeriesStatement parses a string and returns a DropSeriesStatement.
// This function assumes the "DROP SERIES" tokens have already been consumed.
func (p *Parser) parseDropSeriesStatement() (*DropSeriesStatement, error) {
	stmt := &DropSeriesStatement{}
	var err error

	tok, pos, lit := p.ScanIgnoreWhitespace()

	if tok == FROM {
		// Parse source.
		if stmt.Sources, err = p.parseSources(false); err != nil {
			return nil, err
		}

		var err error
		WalkFunc(stmt.Sources, func(n Node) {
			if t, ok := n.(*Measurement); ok {
				// Don't allow database or retention policy in from clause for delete
				// statement.  They apply to the selected database across all retention
				// policies.
				if t.Database != "" {
					err = &ParseError{Message: "database not supported"}
				}
				if t.RetentionPolicy != "" {
					err = &ParseError{Message: "retention policy not supported"}
				}
			}
		})
		if err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Parse condition: "WHERE EXPR".
	if stmt.Condition, err = p.parseCondition(); err != nil {
		return nil, err
	}

	// If they didn't provide a FROM or a WHERE, this query is invalid
	if stmt.Condition == nil && stmt.Sources == nil {
		return nil, newParseError(tokstr(tok, lit), []string{"FROM", "WHERE"}, pos)
	}

	return stmt, nil
}

// parseDropShardStatement parses a string and returns a
// DropShardStatement. This function assumes the "DROP SHARD" tokens
// have already been consumed.
func (p *Parser) parseDropShardStatement() (*DropShardStatement, error) {
	var err error
	stmt := &DropShardStatement{}

	// Parse the ID of the shard to be dropped.
	if stmt.ID, err = p.ParseUInt64(); err != nil {
		return nil, err
	}
	return stmt, nil
}

// parseShowContinuousQueriesStatement parses a string and returns a ShowContinuousQueriesStatement.
// This function assumes the "SHOW CONTINUOUS" tokens have already been consumed.
func (p *Parser) parseShowContinuousQueriesStatement() (*ShowContinuousQueriesStatement, error) {
	return &ShowContinuousQueriesStatement{}, nil
}

// parseGrantsForUserStatement parses a string and returns a ShowGrantsForUserStatement.
// This function assumes the "SHOW GRANTS" tokens have already been consumed.
func (p *Parser) parseGrantsForUserStatement() (*ShowGrantsForUserStatement, error) {
	stmt := &ShowGrantsForUserStatement{}

	// Parse the name of the user to be displayed.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = lit

	return stmt, nil
}

// parseShowDatabasesStatement parses a string and returns a ShowDatabasesStatement.
// This function assumes the "SHOW DATABASE" tokens have already been consumed.
func (p *Parser) parseShowDatabasesStatement() (*ShowDatabasesStatement, error) {
	return &ShowDatabasesStatement{}, nil
}

// parseCreateContinuousQueriesStatement parses a string and returns a CreateContinuousQueryStatement.
// This function assumes the "CREATE CONTINUOUS" tokens have already been consumed.
func (p *Parser) parseCreateContinuousQueryStatement() (*CreateContinuousQueryStatement, error) {
	stmt := &CreateContinuousQueryStatement{}

	// Read the id of the query to create.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = ident

	// Expect an "ON" keyword.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != ON {
		return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
	}

	// Read the name of the database to create the query on.
	if ident, err = p.ParseIdent(); err != nil {
		return nil, err
	}
	stmt.Database = ident

	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == RESAMPLE {
		stmt.ResampleEvery, stmt.ResampleFor, err = p.parseResample()
		if err != nil {
			return nil, err
		}
	} else {
		p.Unscan()
	}

	// Expect a "BEGIN SELECT" tokens.
	if err := p.parseTokens([]Token{BEGIN, SELECT}); err != nil {
		return nil, err
	}

	// Read the select statement to be used as the source.
	source, err := p.parseSelectStatement(targetRequired)
	if err != nil {
		return nil, err
	}
	stmt.Source = source

	// validate that the statement has a non-zero group by interval if it is aggregated
	if !source.IsRawQuery {
		d, err := source.GroupByInterval()
		if d == 0 || err != nil {
			// rewind so we can output an error with some info
			p.Unscan() // Unscan the whitespace
			p.Unscan() // Unscan the last token
			tok, pos, lit := p.ScanIgnoreWhitespace()
			expected := []string{"GROUP BY time(...)"}
			if err != nil {
				expected = append(expected, err.Error())
			}
			return nil, newParseError(tokstr(tok, lit), expected, pos)
		}
	}

	// Expect a "END" keyword.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != END {
		return nil, newParseError(tokstr(tok, lit), []string{"END"}, pos)
	}

	if err := stmt.validate(); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseCreateDatabaseStatement parses a string and returns a CreateDatabaseStatement.
// This function assumes the "CREATE DATABASE" tokens have already been consumed.
func (p *Parser) parseCreateDatabaseStatement() (*CreateDatabaseStatement, error) {
	stmt := &CreateDatabaseStatement{}

	// Parse the name of the database to be created.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = lit

	// Look for "WITH"
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == WITH {
		// validate that at least one of DURATION, NAME, REPLICATION or SHARD is provided
		tok, pos, lit := p.ScanIgnoreWhitespace()
		if tok != DURATION && tok != NAME && tok != REPLICATION && tok != SHARD && tok != FUTURE && tok != PAST {
			return nil, newParseError(tokstr(tok, lit), []string{"DURATION", "NAME", "REPLICATION", "SHARD", "FUTURE", "PAST"}, pos)
		}
		// rewind
		p.Unscan()

		// mark statement as having a RetentionPolicyInfo defined
		stmt.RetentionPolicyCreate = true

		// Look for "DURATION"
		if err := p.parseTokens([]Token{DURATION}); err != nil {
			p.Unscan()
		} else {
			rpDuration, err := p.ParseDuration()
			if err != nil {
				return nil, err
			}
			stmt.RetentionPolicyDuration = &rpDuration
		}

		// Look for "REPLICATION"
		if err := p.parseTokens([]Token{REPLICATION}); err != nil {
			p.Unscan()
		} else {
			rpReplication, err := p.ParseInt(1, math.MaxInt32)
			if err != nil {
				return nil, err
			}
			stmt.RetentionPolicyReplication = &rpReplication
		}

		// Look for "SHARD"
		if err := p.parseTokens([]Token{SHARD}); err != nil {
			p.Unscan()
		} else {
			// Look for "DURATION"
			tok, pos, lit := p.ScanIgnoreWhitespace()
			if tok != DURATION {
				return nil, newParseError(tokstr(tok, lit), []string{"DURATION"}, pos)
			}
			stmt.RetentionPolicyShardGroupDuration, err = p.ParseDuration()
			if err != nil {
				return nil, err
			}
		}

		// Look for write limits
		if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FUTURE {
			d, err := p.parseWriteLimit()
			if err != nil {
				return nil, err
			}
			stmt.FutureWriteLimit = &d
		} else {
			p.Unscan()
		}
		if tok, _, _ := p.ScanIgnoreWhitespace(); tok == PAST {
			d, err := p.parseWriteLimit()
			if err != nil {
				return nil, err
			}
			stmt.PastWriteLimit = &d
		} else {
			p.Unscan()
		}

		// Look for "NAME"
		if err := p.parseTokens([]Token{NAME}); err != nil {
			p.Unscan()
		} else {
			stmt.RetentionPolicyName, err = p.ParseIdent()
			if err != nil {
				return nil, err
			}
		}
	} else {
		p.Unscan()
	}
	return stmt, nil
}

// parseDropDatabaseStatement parses a string and returns a DropDatabaseStatement.
// This function assumes the DROP DATABASE tokens have already been consumed.
func (p *Parser) parseDropDatabaseStatement() (*DropDatabaseStatement, error) {
	stmt := &DropDatabaseStatement{}

	// Parse the name of the database to be dropped.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = lit

	return stmt, nil
}

// parseDropSubscriptionStatement parses a string and returns a DropSubscriptionStatement.
// This function assumes the "DROP SUBSCRIPTION" tokens have already been consumed.
func (p *Parser) parseDropSubscriptionStatement() (*DropSubscriptionStatement, error) {
	stmt := &DropSubscriptionStatement{}

	// Read the id of the subscription to drop.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = ident

	// Expect an "ON" keyword.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != ON {
		return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
	}

	// Read the name of the database.
	if ident, err = p.ParseIdent(); err != nil {
		return nil, err
	}
	stmt.Database = ident

	if tok, pos, lit := p.Scan(); tok != DOT {
		return nil, newParseError(tokstr(tok, lit), []string{"."}, pos)
	}

	// Read the name of the retention policy.
	if ident, err = p.ParseIdent(); err != nil {
		return nil, err
	}
	stmt.RetentionPolicy = ident

	return stmt, nil
}

// parseDropRetentionPolicyStatement parses a string and returns a DropRetentionPolicyStatement.
// This function assumes the DROP RETENTION POLICY tokens have been consumed.
func (p *Parser) parseDropRetentionPolicyStatement() (*DropRetentionPolicyStatement, error) {
	stmt := &DropRetentionPolicyStatement{}

	// Parse the policy name.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = ident

	// Consume the required ON token.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != ON {
		return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
	}

	// Parse the database name.
	if stmt.Database, err = p.ParseIdent(); err != nil {
		return nil, err
	}

	return stmt, nil
}

// parseCreateUserStatement parses a string and returns a CreateUserStatement.
// This function assumes the "CREATE USER" tokens have already been consumed.
func (p *Parser) parseCreateUserStatement() (*CreateUserStatement, error) {
	stmt := &CreateUserStatement{}

	// Parse name of the user to be created.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = ident

	// Consume "WITH PASSWORD" tokens
	if err := p.parseTokens([]Token{WITH, PASSWORD}); err != nil {
		return nil, err
	}

	// Parse new user's password
	if ident, err = p.parseString(); err != nil {
		return nil, err
	}
	stmt.Password = ident

	// Check for option WITH clause.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok != WITH {
		p.Unscan()
		return stmt, nil
	}

	// "WITH ALL PRIVILEGES" grants the new user admin privilege.
	// Only admin privilege can be set on user creation.
	if err := p.parseTokens([]Token{ALL, PRIVILEGES}); err != nil {
		return nil, err
	}
	stmt.Admin = true

	return stmt, nil
}

// parseDropUserStatement parses a string and returns a DropUserStatement.
// This function assumes the DROP USER tokens have already been consumed.
func (p *Parser) parseDropUserStatement() (*DropUserStatement, error) {
	stmt := &DropUserStatement{}

	// Parse the name of the user to be dropped.
	lit, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = lit

	return stmt, nil
}

// parseExplainStatement parses a string and return an ExplainStatement.
// This function assumes the EXPLAIN token has already been consumed.
func (p *Parser) parseExplainStatement() (*ExplainStatement, error) {
	stmt := &ExplainStatement{}

	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == ANALYZE {
		stmt.Analyze = true
	} else {
		p.Unscan()
	}

	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == VERBOSE {
		stmt.Verbose = true
	} else {
		p.Unscan()
	}

	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != SELECT {
		return nil, newParseError(tokstr(tok, lit), []string{"SELECT"}, pos)
	}

	s, err := p.parseSelectStatement(targetNotRequired)
	if err != nil {
		return nil, err
	}
	stmt.Statement = s
	return stmt, nil
}

// parseShowShardGroupsStatement parses a string for "SHOW SHARD GROUPS" statement.
// This function assumes the "SHOW SHARD GROUPS" tokens have already been consumed.
func (p *Parser) parseShowShardGroupsStatement() (*ShowShardGroupsStatement, error) {
	return &ShowShardGroupsStatement{}, nil
}

// parseShowShardsStatement parses a string for "SHOW SHARDS" statement.
// This function assumes the "SHOW SHARDS" tokens have already been consumed.
func (p *Parser) parseShowShardsStatement() (*ShowShardsStatement, error) {
	return &ShowShardsStatement{}, nil
}

// parseShowStatsStatement parses a string and returns a ShowStatsStatement.
// This function assumes the "SHOW STATS" tokens have already been consumed.
func (p *Parser) parseShowStatsStatement() (*ShowStatsStatement, error) {
	stmt := &ShowStatsStatement{}
	var err error

	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FOR {
		stmt.Module, err = p.parseString()
	} else {
		p.Unscan()
	}

	return stmt, err
}

// parseShowDiagnostics parses a string and returns a ShowDiagnosticsStatement.
func (p *Parser) parseShowDiagnosticsStatement() (*ShowDiagnosticsStatement, error) {
	stmt := &ShowDiagnosticsStatement{}
	var err error

	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FOR {
		stmt.Module, err = p.parseString()
	} else {
		p.Unscan()
	}

	return stmt, err
}

// parseDropContinuousQueriesStatement parses a string and returns a DropContinuousQueryStatement.
// This function assumes the "DROP CONTINUOUS" tokens have already been consumed.
func (p *Parser) parseDropContinuousQueryStatement() (*DropContinuousQueryStatement, error) {
	stmt := &DropContinuousQueryStatement{}

	// Read the id of the query to drop.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	stmt.Name = ident

	// Expect an "ON" keyword.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != ON {
		return nil, newParseError(tokstr(tok, lit), []string{"ON"}, pos)
	}

	// Read the name of the database to remove the query from.
	if ident, err = p.ParseIdent(); err != nil {
		return nil, err
	}
	stmt.Database = ident

	return stmt, nil
}

// parseFields parses a list of one or more fields.
func (p *Parser) parseFields() (Fields, error) {
	var fields Fields

	for {
		// Parse the field.
		f, err := p.parseField()
		if err != nil {
			return nil, err
		}

		// Add new field.
		fields = append(fields, f)

		// If there's not a comma next then stop parsing fields.
		if tok, _, _ := p.Scan(); tok != COMMA {
			p.Unscan()
			break
		}
	}
	return fields, nil
}

// parseField parses a single field.
func (p *Parser) parseField() (*Field, error) {
	f := &Field{}

	// Attempt to parse a regex.
	re, err := p.parseRegex()
	if err != nil {
		return nil, err
	} else if re != nil {
		f.Expr = re
	} else {
		_, pos, _ := p.ScanIgnoreWhitespace()
		p.Unscan()
		// Parse the expression first.
		expr, err := p.ParseExpr()
		if err != nil {
			return nil, err
		}
		var c validateField
		Walk(&c, expr)
		if c.foundInvalid {
			return nil, fmt.Errorf("invalid operator %s in SELECT clause at line %d, char %d; operator is intended for WHERE clause", c.badToken, pos.Line+1, pos.Char+1)
		}
		f.Expr = expr
	}

	// Parse the alias if the current and next tokens are "WS AS".
	alias, err := p.parseAlias()
	if err != nil {
		return nil, err
	}
	f.Alias = alias

	// Consume all trailing whitespace.
	p.consumeWhitespace()

	return f, nil
}

// validateField checks if the Expr is a valid field. We disallow all binary expression
// that return a boolean.
type validateField struct {
	foundInvalid bool
	badToken     Token
}

func (c *validateField) Visit(n Node) Visitor {
	e, ok := n.(*BinaryExpr)
	if !ok {
		return c
	}

	switch e.Op {
	case EQ, NEQ, EQREGEX,
		NEQREGEX, LT, LTE, GT, GTE,
		AND, OR:
		c.foundInvalid = true
		c.badToken = e.Op
		return nil
	}
	return c
}

// parseAlias parses the "AS IDENT" alias for fields and dimensions.
func (p *Parser) parseAlias() (string, error) {
	// Check if the next token is "AS". If not, then Unscan and exit.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok != AS {
		p.Unscan()
		return "", nil
	}

	// Then we should have the alias identifier.
	lit, err := p.ParseIdent()
	if err != nil {
		return "", err
	}
	return lit, nil
}

// parseSources parses a comma delimited list of sources.
func (p *Parser) parseSources(subqueries bool) (Sources, error) {
	var sources Sources

	for {
		s, err := p.parseSource(subqueries)
		if err != nil {
			return nil, err
		}
		sources = append(sources, s)

		if tok, _, _ := p.ScanIgnoreWhitespace(); tok != COMMA {
			p.Unscan()
			break
		}
	}

	return sources, nil
}

// peekRune returns the next rune that would be read by the scanner.
func (p *Parser) peekRune() rune {
	r, _, _ := p.s.s.r.ReadRune()
	if r != eof {
		_ = p.s.s.r.UnreadRune()
	}

	return r
}

func (p *Parser) parseSource(subqueries bool) (Source, error) {
	m := &Measurement{}

	// Attempt to parse a regex.
	re, err := p.parseRegex()
	if err != nil {
		return nil, err
	} else if re != nil {
		m.Regex = re
		// Regex is always last so we're done.
		return m, nil
	}

	// If there is no regular expression, this might be a subquery.
	// Parse the subquery if we are in a query that allows them as a source.
	if m.Regex == nil && subqueries {
		if tok, _, _ := p.ScanIgnoreWhitespace(); tok == LPAREN {
			if err := p.parseTokens([]Token{SELECT}); err != nil {
				return nil, err
			}

			stmt, err := p.parseSelectStatement(targetSubquery)
			if err != nil {
				return nil, err
			}

			if err := p.parseTokens([]Token{RPAREN}); err != nil {
				return nil, err
			}
			return &SubQuery{Statement: stmt}, nil
		} else {
			p.Unscan()
		}
	}

	// Didn't find a regex so parse segmented identifiers.
	idents, err := p.parseSegmentedIdents()
	if err != nil {
		return nil, err
	}

	// If we already have the max allowed idents, we're done.
	if len(idents) == 3 {
		m.Database, m.RetentionPolicy, m.Name = idents[0], idents[1], idents[2]
		return m, nil
	}
	// Check again for regex.
	re, err = p.parseRegex()
	if err != nil {
		return nil, err
	} else if re != nil {
		m.Regex = re
	}

	// Assign identifiers to their proper locations.
	switch len(idents) {
	case 1:
		if re != nil {
			m.RetentionPolicy = idents[0]
		} else {
			m.Name = idents[0]
		}
	case 2:
		if re != nil {
			m.Database, m.RetentionPolicy = idents[0], idents[1]
		} else {
			m.RetentionPolicy, m.Name = idents[0], idents[1]
		}
	}

	return m, nil
}

// parseCondition parses the "WHERE" clause of the query, if it exists.
func (p *Parser) parseCondition() (Expr, error) {
	// Check if the WHERE token exists.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok != WHERE {
		p.Unscan()
		return nil, nil
	}

	// Scan the identifier for the source.
	expr, err := p.ParseExpr()
	if err != nil {
		return nil, err
	}

	return expr, nil
}

// parseDimensions parses the "GROUP BY" clause of the query, if it exists.
func (p *Parser) parseDimensions() (Dimensions, error) {
	// If the next token is not GROUP then exit.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok != GROUP {
		p.Unscan()
		return nil, nil
	}

	// Now the next token should be "BY".
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != BY {
		return nil, newParseError(tokstr(tok, lit), []string{"BY"}, pos)
	}

	var dimensions Dimensions
	for {
		// Parse the dimension.
		d, err := p.parseDimension()
		if err != nil {
			return nil, err
		}

		// Add new dimension.
		dimensions = append(dimensions, d)

		// If there's not a comma next then stop parsing dimensions.
		if tok, _, _ := p.Scan(); tok != COMMA {
			p.Unscan()
			break
		}
	}
	return dimensions, nil
}

// parseDimension parses a single dimension.
func (p *Parser) parseDimension() (*Dimension, error) {
	re, err := p.parseRegex()
	if err != nil {
		return nil, err
	} else if re != nil {
		return &Dimension{Expr: re}, nil
	}

	// Parse the expression first.
	expr, err := p.ParseExpr()
	if err != nil {
		return nil, err
	}

	// Consume all trailing whitespace.
	p.consumeWhitespace()

	return &Dimension{Expr: expr}, nil
}

// parseFill parses the fill call and its options.
func (p *Parser) parseFill() (FillOption, interface{}, error) {
	// Parse the expression first.
	tok, _, lit := p.ScanIgnoreWhitespace()
	p.Unscan()
	if tok != IDENT || strings.ToLower(lit) != "fill" {
		return NullFill, nil, nil
	}

	expr, err := p.ParseExpr()
	if err != nil {
		return NullFill, nil, err
	}
	fill, ok := expr.(*Call)
	if !ok {
		return NullFill, nil, errors.New("fill must be a function call")
	} else if len(fill.Args) != 1 {
		return NullFill, nil, errors.New("fill requires an argument, e.g.: 0, null, none, previous, linear")
	}
	switch fill.Args[0].String() {
	case "null":
		return NullFill, nil, nil
	case "none":
		return NoFill, nil, nil
	case "previous":
		return PreviousFill, nil, nil
	case "linear":
		return LinearFill, nil, nil
	default:
		switch num := fill.Args[0].(type) {
		case *IntegerLiteral:
			return NumberFill, num.Val, nil
		case *NumberLiteral:
			return NumberFill, num.Val, nil
		default:
			return NullFill, nil, fmt.Errorf("expected number argument in fill()")
		}
	}
}

// parseLocation parses the timezone call and its arguments.
func (p *Parser) parseLocation() (*time.Location, error) {
	// Parse the expression first.
	tok, _, lit := p.ScanIgnoreWhitespace()
	p.Unscan()
	if tok != IDENT || strings.ToLower(lit) != "tz" {
		return nil, nil
	}

	expr, err := p.ParseExpr()
	if err != nil {
		return nil, err
	}
	tz, ok := expr.(*Call)
	if !ok {
		return nil, errors.New("tz must be a function call")
	} else if len(tz.Args) != 1 {
		return nil, errors.New("tz requires exactly one argument")
	}

	tzname, ok := tz.Args[0].(*StringLiteral)
	if !ok {
		return nil, errors.New("expected string argument in tz()")
	}

	loc, err := time.LoadLocation(tzname.Val)
	if err != nil {
		// Do not pass the same error message as the error may contain sensitive pathnames.
		return nil, fmt.Errorf("unable to find time zone %s", tzname.Val)
	}
	return loc, nil
}

// ParseOptionalTokenAndInt parses the specified token followed
// by an int, if it exists.
func (p *Parser) ParseOptionalTokenAndInt(t Token) (int, error) {
	// Check if the token exists.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok != t {
		p.Unscan()
		return 0, nil
	}

	// Scan the number.
	tok, pos, lit := p.ScanIgnoreWhitespace()
	if tok != INTEGER {
		return 0, newParseError(tokstr(tok, lit), []string{"integer"}, pos)
	}

	// Parse number.
	n, _ := strconv.ParseInt(lit, 10, 64)
	if n < 0 {
		msg := fmt.Sprintf("%s must be >= 0", t.String())
		return 0, &ParseError{Message: msg, Pos: pos}
	}

	return int(n), nil
}

// parseOrderBy parses the "ORDER BY" clause of a query, if it exists.
func (p *Parser) parseOrderBy() (SortFields, error) {
	// Return nil result and nil error if no ORDER token at this position.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok != ORDER {
		p.Unscan()
		return nil, nil
	}

	// Parse the required BY token.
	if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != BY {
		return nil, newParseError(tokstr(tok, lit), []string{"BY"}, pos)
	}

	// Parse the ORDER BY fields.
	fields, err := p.parseSortFields()
	if err != nil {
		return nil, err
	}

	return fields, nil
}

// parseSortFields parses the sort fields for an ORDER BY clause.
func (p *Parser) parseSortFields() (SortFields, error) {
	var fields SortFields

	tok, pos, lit := p.ScanIgnoreWhitespace()

	switch tok {
	// The first field after an order by may not have a field name (e.g. ORDER BY ASC)
	case ASC, DESC:
		fields = append(fields, &SortField{Ascending: (tok == ASC)})
	// If it's a token, parse it as a sort field.  At least one is required.
	case IDENT:
		p.Unscan()
		field, err := p.parseSortField()
		if err != nil {
			return nil, err
		}

		if lit != "time" {
			return nil, errors.New("only ORDER BY time supported at this time")
		}

		fields = append(fields, field)
	// Parse error...
	default:
		return nil, newParseError(tokstr(tok, lit), []string{"identifier", "ASC", "DESC"}, pos)
	}

	// Parse additional fields.
	for {
		tok, _, _ := p.ScanIgnoreWhitespace()

		if tok != COMMA {
			p.Unscan()
			break
		}

		field, err := p.parseSortField()
		if err != nil {
			return nil, err
		}

		fields = append(fields, field)
	}

	if len(fields) > 1 {
		return nil, errors.New("only ORDER BY time supported at this time")
	}

	return fields, nil
}

// parseSortField parses one field of an ORDER BY clause.
func (p *Parser) parseSortField() (*SortField, error) {
	field := &SortField{}

	// Parse sort field name.
	ident, err := p.ParseIdent()
	if err != nil {
		return nil, err
	}
	field.Name = ident

	// Check for optional ASC or DESC clause. Default is ASC.
	tok, _, _ := p.ScanIgnoreWhitespace()
	if tok != ASC && tok != DESC {
		p.Unscan()
		tok = ASC
	}
	field.Ascending = (tok == ASC)

	return field, nil
}

// ParseVarRef parses a reference to a measurement or field.
func (p *Parser) ParseVarRef() (*VarRef, error) {
	// Parse the segments of the variable ref.
	segments, err := p.parseSegmentedIdents()
	if err != nil {
		return nil, err
	}

	var dtype DataType
	if tok, _, _ := p.Scan(); tok == DOUBLECOLON {
		tok, pos, lit := p.Scan()
		switch tok {
		case IDENT:
			switch strings.ToLower(lit) {
			case "float":
				dtype = Float
			case "integer":
				dtype = Integer
			case "unsigned":
				dtype = Unsigned
			case "string":
				dtype = String
			case "boolean":
				dtype = Boolean
			default:
				return nil, newParseError(tokstr(tok, lit), []string{"float", "integer", "unsigned", "string", "boolean", "field", "tag"}, pos)
			}
		case FIELD:
			dtype = AnyField
		case TAG:
			dtype = Tag
		default:
			return nil, newParseError(tokstr(tok, lit), []string{"float", "integer", "string", "boolean", "field", "tag"}, pos)
		}
	} else {
		p.Unscan()
	}

	vr := &VarRef{Val: strings.Join(segments, "."), Type: dtype}

	return vr, nil
}

// ParseExpr parses an expression.
func (p *Parser) ParseExpr() (Expr, error) {
	var err error
	// Dummy root node.
	root := &BinaryExpr{}

	// Parse a non-binary expression type to start.
	// This variable will always be the root of the expression tree.
	root.RHS, err = p.parseUnaryExpr()
	if err != nil {
		return nil, err
	}

	// Loop over operations and unary exprs and build a tree based on precendence.
	for {
		// If the next token is NOT an operator then return the expression.
		op, _, _ := p.ScanIgnoreWhitespace()
		if !op.isOperator() {
			p.Unscan()
			return root.RHS, nil
		}

		// Otherwise parse the next expression.
		var rhs Expr
		if IsRegexOp(op) {
			// RHS of a regex operator must be a regular expression.
			if rhs, err = p.parseRegex(); err != nil {
				return nil, err
			}
			// parseRegex can return an empty type, but we need it to be present
			if rhs.(*RegexLiteral) == nil {
				tok, pos, lit := p.ScanIgnoreWhitespace()
				return nil, newParseError(tokstr(tok, lit), []string{"regex"}, pos)
			}
		} else {
			if rhs, err = p.parseUnaryExpr(); err != nil {
				return nil, err
			}
		}

		// Find the right spot in the tree to add the new expression by
		// descending the RHS of the expression tree until we reach the last
		// BinaryExpr or a BinaryExpr whose RHS has an operator with
		// precedence >= the operator being added.
		for node := root; ; {
			r, ok := node.RHS.(*BinaryExpr)
			if !ok || r.Op.Precedence() >= op.Precedence() {
				// Add the new expression here and break.
				node.RHS = &BinaryExpr{LHS: node.RHS, RHS: rhs, Op: op}
				break
			}
			node = r
		}
	}
}

// parseUnaryExpr parses an non-binary expression.
func (p *Parser) parseUnaryExpr() (Expr, error) {
	// If the first token is a LPAREN then parse it as its own grouped expression.
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == LPAREN {
		expr, err := p.ParseExpr()
		if err != nil {
			return nil, err
		}

		// Expect an RPAREN at the end.
		if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != RPAREN {
			return nil, newParseError(tokstr(tok, lit), []string{")"}, pos)
		}

		return &ParenExpr{Expr: expr}, nil
	}
	p.Unscan()

	// Read next token.
	tok, pos, lit := p.ScanIgnoreWhitespace()
	switch tok {
	case IDENT:
		// If the next immediate token is a left parentheses, parse as function call.
		// Otherwise parse as a variable reference.
		if tok0, _, _ := p.Scan(); tok0 == LPAREN {
			return p.parseCall(lit)
		}

		p.Unscan() // Unscan the last token (wasn't an LPAREN)
		p.Unscan() // Unscan the IDENT token

		// Parse it as a VarRef.
		return p.ParseVarRef()
	case DISTINCT:
		// If the next immediate token is a left parentheses, parse as function call.
		// Otherwise parse as a Distinct expression.
		tok0, pos, lit := p.Scan()
		if tok0 == LPAREN {
			return p.parseCall("distinct")
		} else if tok0 == WS {
			tok1, pos, lit := p.ScanIgnoreWhitespace()
			if tok1 != IDENT {
				return nil, newParseError(tokstr(tok1, lit), []string{"identifier"}, pos)
			}
			return &Distinct{Val: lit}, nil
		}

		return nil, newParseError(tokstr(tok0, lit), []string{"(", "identifier"}, pos)
	case STRING:
		return &StringLiteral{Val: lit}, nil
	case NUMBER:
		v, err := strconv.ParseFloat(lit, 64)
		if err != nil {
			return nil, &ParseError{Message: "unable to parse number", Pos: pos}
		}
		return &NumberLiteral{Val: v}, nil
	case INTEGER:
		v, err := strconv.ParseInt(lit, 10, 64)
		if err != nil {
			// The literal may be too large to fit into an int64. If it is, use an unsigned integer.
			// The check for negative numbers is handled somewhere else so this should always be a positive number.
			if v, err := strconv.ParseUint(lit, 10, 64); err == nil {
				return &UnsignedLiteral{Val: v}, nil
			}
			return nil, &ParseError{Message: "unable to parse integer", Pos: pos}
		}
		return &IntegerLiteral{Val: v}, nil
	case TRUE, FALSE:
		return &BooleanLiteral{Val: tok == TRUE}, nil
	case DURATIONVAL:
		v, err := ParseDuration(lit)
		if err != nil {
			return nil, err
		}
		return &DurationLiteral{Val: v}, nil
	case MUL:
		wc := &Wildcard{}
		if tok, _, _ := p.Scan(); tok == DOUBLECOLON {
			tok, pos, lit := p.Scan()
			switch tok {
			case FIELD, TAG:
				wc.Type = tok
			default:
				return nil, newParseError(tokstr(tok, lit), []string{"field", "tag"}, pos)
			}
		} else {
			p.Unscan()
		}
		return wc, nil
	case REGEX:
		re, err := regexp.Compile(lit)
		if err != nil {
			return nil, &ParseError{Message: err.Error(), Pos: pos}
		}
		return &RegexLiteral{Val: re}, nil
	case BOUNDPARAM:
		// If we have a BOUNDPARAM in the token stream,
		// it wasn't resolved by the parser to another
		// token type which means it is invalid.
		// Figure out what is wrong with it.
		k := strings.TrimPrefix(lit, "$")
		if len(k) == 0 {
			return nil, errors.New("empty bound parameter")
		}

		v, ok := p.params[k]
		if !ok {
			return nil, fmt.Errorf("missing parameter: %s", k)
		}

		// The value must be an ErrorValue.
		// Return the value as an error. A non-error value
		// would have been substituted as something else.
		return nil, errors.New(v.Value())
	case ADD, SUB:
		mul := 1
		if tok == SUB {
			mul = -1
		}

		tok0, pos0, lit0 := p.ScanIgnoreWhitespace()
		switch tok0 {
		case NUMBER, INTEGER, DURATIONVAL, LPAREN, IDENT:
			// Unscan the token and use parseUnaryExpr.
			p.Unscan()

			lit, err := p.parseUnaryExpr()
			if err != nil {
				return nil, err
			}

			switch lit := lit.(type) {
			case *NumberLiteral:
				lit.Val *= float64(mul)
			case *IntegerLiteral:
				lit.Val *= int64(mul)
			case *UnsignedLiteral:
				if tok == SUB {
					// Because of twos-complement integers and the method we parse, math.MinInt64 will be parsed
					// as an UnsignedLiteral because it overflows an int64, but it fits into int64 if it were parsed
					// as a negative number instead.
					if lit.Val == uint64(math.MaxInt64+1) {
						return &IntegerLiteral{Val: int64(-lit.Val)}, nil
					}
					return nil, fmt.Errorf("constant -%d underflows int64", lit.Val)
				}
			case *DurationLiteral:
				lit.Val *= time.Duration(mul)
			case *VarRef, *Call, *ParenExpr:
				// Multiply the variable.
				return &BinaryExpr{
					Op:  MUL,
					LHS: &IntegerLiteral{Val: int64(mul)},
					RHS: lit,
				}, nil
			default:
				panic(fmt.Sprintf("unexpected literal: %T", lit))
			}
			return lit, nil
		default:
			return nil, newParseError(tokstr(tok0, lit0), []string{"identifier", "number", "duration", "("}, pos0)
		}
	default:
		return nil, newParseError(tokstr(tok, lit), []string{"identifier", "string", "number", "bool"}, pos)
	}
}

// parseRegex parses a regular expression.
func (p *Parser) parseRegex() (*RegexLiteral, error) {
	nextRune := p.peekRune()
	if isWhitespace(nextRune) {
		p.consumeWhitespace()
	}

	// If the next character is not a '/', then return nils.
	nextRune = p.peekRune()
	if nextRune == '$' {
		// This might be a bound parameter and it might
		// resolve to a regex.
		tok, _, _ := p.Scan()
		p.Unscan()
		if tok != REGEX {
			// It was not a regular expression so return.
			return nil, nil
		}
	} else if nextRune != '/' {
		return nil, nil
	}

	tok, pos, lit := p.ScanRegex()

	if tok == BADESCAPE {
		msg := fmt.Sprintf("bad escape: %s", lit)
		return nil, &ParseError{Message: msg, Pos: pos}
	} else if tok == BADREGEX {
		msg := fmt.Sprintf("bad regex: %s", lit)
		return nil, &ParseError{Message: msg, Pos: pos}
	} else if tok != REGEX {
		return nil, newParseError(tokstr(tok, lit), []string{"regex"}, pos)
	}

	re, err := regexp.Compile(lit)
	if err != nil {
		return nil, &ParseError{Message: err.Error(), Pos: pos}
	}

	return &RegexLiteral{Val: re}, nil
}

// parseCall parses a function call.
// This function assumes the function name and LPAREN have been consumed.
func (p *Parser) parseCall(name string) (*Call, error) {
	name = strings.ToLower(name)

	// Parse first function argument if one exists.
	var args []Expr
	re, err := p.parseRegex()
	if err != nil {
		return nil, err
	} else if re != nil {
		args = append(args, re)
	} else {
		// If there's a right paren then just return immediately.
		if tok, _, _ := p.Scan(); tok == RPAREN {
			return &Call{Name: name}, nil
		}
		p.Unscan()

		arg, err := p.ParseExpr()
		if err != nil {
			return nil, err
		}
		args = append(args, arg)
	}

	// Parse additional function arguments if there is a comma.
	for {
		// If there's not a comma, stop parsing arguments.
		if tok, _, _ := p.ScanIgnoreWhitespace(); tok != COMMA {
			p.Unscan()
			break
		}

		re, err := p.parseRegex()
		if err != nil {
			return nil, err
		} else if re != nil {
			args = append(args, re)
			continue
		}

		// Parse an expression argument.
		arg, err := p.ParseExpr()
		if err != nil {
			return nil, err
		}
		args = append(args, arg)
	}

	// There should be a right parentheses at the end.
	if tok, pos, lit := p.Scan(); tok != RPAREN {
		return nil, newParseError(tokstr(tok, lit), []string{")"}, pos)
	}

	return &Call{Name: name, Args: args}, nil
}

// parseResample parses a RESAMPLE [EVERY <duration>] [FOR <duration>].
// This function assumes RESAMPLE has already been consumed.
// EVERY and FOR are optional, but at least one of the two has to be used.
func (p *Parser) parseResample() (time.Duration, time.Duration, error) {
	var interval time.Duration
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == EVERY {
		tok, pos, lit := p.ScanIgnoreWhitespace()
		if tok != DURATIONVAL {
			return 0, 0, newParseError(tokstr(tok, lit), []string{"duration"}, pos)
		}

		d, err := ParseDuration(lit)
		if err != nil {
			return 0, 0, &ParseError{Message: err.Error(), Pos: pos}
		}
		interval = d
	} else {
		p.Unscan()
	}

	var maxDuration time.Duration
	if tok, _, _ := p.ScanIgnoreWhitespace(); tok == FOR {
		tok, pos, lit := p.ScanIgnoreWhitespace()
		if tok != DURATIONVAL {
			return 0, 0, newParseError(tokstr(tok, lit), []string{"duration"}, pos)
		}

		d, err := ParseDuration(lit)
		if err != nil {
			return 0, 0, &ParseError{Message: err.Error(), Pos: pos}
		}
		maxDuration = d
	} else {
		p.Unscan()
	}

	// Neither EVERY or FOR were read, so read the next token again
	// so we can return a suitable error message.
	if interval == 0 && maxDuration == 0 {
		tok, pos, lit := p.ScanIgnoreWhitespace()
		return 0, 0, newParseError(tokstr(tok, lit), []string{"EVERY", "FOR"}, pos)
	}
	return interval, maxDuration, nil
}

// Scan returns the next token from the underlying scanner.
func (p *Parser) Scan() (tok Token, pos Pos, lit string) {
	return p.scan(p.s.Scan)
}

// ScanRegex returns the next token from the underlying scanner
// using the regex scanner.
func (p *Parser) ScanRegex() (tok Token, pos Pos, lit string) {
	return p.scan(p.s.ScanRegex)
}

type scanFunc func() (tok Token, pos Pos, lit string)

func (p *Parser) scan(fn scanFunc) (tok Token, pos Pos, lit string) {
	tok, pos, lit = fn()
	if tok == BOUNDPARAM {
		// If we have a bound parameter, attempt to
		// replace it in the scanner. If the bound parameter
		// isn't valid, do not perform the replacement.
		k := strings.TrimPrefix(lit, "$")
		if len(k) != 0 {
			if v, ok := p.params[k]; ok {
				tok, lit = v.TokenType(), v.Value()
			}
		}
	}
	return tok, pos, lit
}

// ScanIgnoreWhitespace scans the next non-whitespace and non-comment token.
func (p *Parser) ScanIgnoreWhitespace() (tok Token, pos Pos, lit string) {
	for {
		tok, pos, lit = p.Scan()
		if tok == WS || tok == COMMENT {
			continue
		}
		return
	}
}

// consumeWhitespace scans the next token if it's whitespace.
func (p *Parser) consumeWhitespace() {
	if tok, _, _ := p.Scan(); tok != WS {
		p.Unscan()
	}
}

// Unscan pushes the previously read token back onto the buffer.
func (p *Parser) Unscan() { p.s.Unscan() }

// ParseDuration parses a time duration from a string.
// This is needed instead of time.ParseDuration because this will support
// the full syntax that InfluxQL supports for specifying durations
// including weeks and days.
func ParseDuration(s string) (time.Duration, error) {
	// Return an error if the string is blank or one character
	if len(s) < 2 {
		return 0, ErrInvalidDuration
	}

	// Split string into individual runes.
	a := []rune(s)

	// Start with a zero duration.
	var d time.Duration
	i := 0

	// Check for a negative.
	isNegative := false
	if a[i] == '-' {
		isNegative = true
		i++
	}

	var measure int64
	var unit string

	// Parsing loop.
	for i < len(a) {
		// Find the number portion.
		start := i
		for ; i < len(a) && isDigit(a[i]); i++ {
			// Scan for the digits.
		}

		// Check if we reached the end of the string prematurely.
		if i >= len(a) || i == start {
			return 0, ErrInvalidDuration
		}

		// Parse the numeric part.
		n, err := strconv.ParseInt(string(a[start:i]), 10, 64)
		if err != nil {
			return 0, ErrInvalidDuration
		}
		measure = n

		// Extract the unit of measure.
		// If the last two characters are "ms" then parse as milliseconds.
		// Otherwise just use the last character as the unit of measure.
		unit = string(a[i])
		switch a[i] {
		case 'n':
			if i+1 < len(a) && a[i+1] == 's' {
				unit = string(a[i : i+2])
				d += time.Duration(n)
				i += 2
				continue
			}
			return 0, ErrInvalidDuration
		case 'u', 'µ':
			d += time.Duration(n) * time.Microsecond
		case 'm':
			if i+1 < len(a) && a[i+1] == 's' {
				unit = string(a[i : i+2])
				d += time.Duration(n) * time.Millisecond
				i += 2
				continue
			}
			d += time.Duration(n) * time.Minute
		case 's':
			d += time.Duration(n) * time.Second
		case 'h':
			d += time.Duration(n) * time.Hour
		case 'd':
			d += time.Duration(n) * 24 * time.Hour
		case 'w':
			d += time.Duration(n) * 7 * 24 * time.Hour
		default:
			return 0, ErrInvalidDuration
		}
		i++
	}

	// Check to see if we overflowed a duration
	if d < 0 && !isNegative {
		return 0, fmt.Errorf("overflowed duration %d%s: choose a smaller duration or INF", measure, unit)
	}

	if isNegative {
		d = -d
	}
	return d, nil
}

// FormatDuration formats a duration to a string.
func FormatDuration(d time.Duration) string {
	if d == 0 {
		return "0s"
	} else if d%(7*24*time.Hour) == 0 {
		return fmt.Sprintf("%dw", d/(7*24*time.Hour))
	} else if d%(24*time.Hour) == 0 {
		return fmt.Sprintf("%dd", d/(24*time.Hour))
	} else if d%time.Hour == 0 {
		return fmt.Sprintf("%dh", d/time.Hour)
	} else if d%time.Minute == 0 {
		return fmt.Sprintf("%dm", d/time.Minute)
	} else if d%time.Second == 0 {
		return fmt.Sprintf("%ds", d/time.Second)
	} else if d%time.Millisecond == 0 {
		return fmt.Sprintf("%dms", d/time.Millisecond)
	} else if d%time.Microsecond == 0 {
		// Although we accept both "u" and "µ" when reading microsecond durations,
		// we output with "u", which can be represented in 1 byte,
		// instead of "µ", which requires 2 bytes.
		return fmt.Sprintf("%du", d/time.Microsecond)
	}
	return fmt.Sprintf("%dns", d)
}

// parseTokens consumes an expected sequence of tokens.
func (p *Parser) parseTokens(toks []Token) error {
	for _, expected := range toks {
		if tok, pos, lit := p.ScanIgnoreWhitespace(); tok != expected {
			return newParseError(tokstr(tok, lit), []string{tokens[expected]}, pos)
		}
	}
	return nil
}

var (
	// Quote String replacer.
	qsReplacer = strings.NewReplacer("\n", `\n`, `\`, `\\`, `'`, `\'`)

	// Quote Ident replacer.
	qiReplacer = strings.NewReplacer("\n", `\n`, `\`, `\\`, `"`, `\"`)
)

// QuoteString returns a quoted string.
func QuoteString(s string) string {
	return `'` + qsReplacer.Replace(s) + `'`
}

// QuoteIdent returns a quoted identifier from multiple bare identifiers.
func QuoteIdent(segments ...string) string {
	var buf strings.Builder
	for i, segment := range segments {
		needQuote := IdentNeedsQuotes(segment) ||
			((i < len(segments)-1) && segment != "") || // not last segment && not ""
			((i == 0 || i == len(segments)-1) && segment == "") // the first or last segment and an empty string

		if needQuote {
			_ = buf.WriteByte('"')
		}

		_, _ = buf.WriteString(qiReplacer.Replace(segment))

		if needQuote {
			_ = buf.WriteByte('"')
		}

		if i < len(segments)-1 {
			_ = buf.WriteByte('.')
		}
	}
	return buf.String()
}

// IdentNeedsQuotes returns true if the ident string given would require quotes.
func IdentNeedsQuotes(ident string) bool {
	// check if this identifier is a keyword
	tok := Lookup(ident)
	if tok != IDENT {
		return true
	}
	for i, r := range ident {
		if i == 0 && !isIdentFirstChar(r) {
			return true
		} else if i > 0 && !isIdentChar(r) {
			return true
		}
	}
	return false
}

// isDateString returns true if the string looks like a date-only time literal.
func isDateString(s string) bool { return dateStringRegexp.MatchString(s) }

// isDateTimeString returns true if the string looks like a date+time time literal.
func isDateTimeString(s string) bool { return dateTimeStringRegexp.MatchString(s) }

var dateStringRegexp = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
var dateTimeStringRegexp = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}.+`)

// ErrInvalidDuration is returned when parsing a malformed duration.
var ErrInvalidDuration = errors.New("invalid duration")

// ParseError represents an error that occurred during parsing.
type ParseError struct {
	Message  string
	Found    string
	Expected []string
	Pos      Pos
}

// newParseError returns a new instance of ParseError.
func newParseError(found string, expected []string, pos Pos) *ParseError {
	return &ParseError{Found: found, Expected: expected, Pos: pos}
}

// Error returns the string representation of the error.
func (e *ParseError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("%s at line %d, char %d", e.Message, e.Pos.Line+1, e.Pos.Char+1)
	}
	return fmt.Sprintf("found %s, expected %s at line %d, char %d", e.Found, strings.Join(e.Expected, ", "), e.Pos.Line+1, e.Pos.Char+1)
}
