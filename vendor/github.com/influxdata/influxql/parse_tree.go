package influxql

import (
	"fmt"
)

var Language = &ParseTree{}

type ParseTree struct {
	Handlers map[Token]func(*Parser) (Statement, error)
	Tokens   map[Token]*ParseTree
	Keys     []string
}

// With passes the current parse tree to a function to allow nested functions.
func (t *ParseTree) With(fn func(*ParseTree)) {
	fn(t)
}

// Group groups together a set of related handlers with a common token prefix.
func (t *ParseTree) Group(tokens ...Token) *ParseTree {
	for _, tok := range tokens {
		// Look for the parse tree for this token.
		if subtree := t.Tokens[tok]; subtree != nil {
			t = subtree
			continue
		}

		// No subtree exists yet. Verify that we don't have a conflicting
		// statement.
		if _, conflict := t.Handlers[tok]; conflict {
			panic(fmt.Sprintf("conflict for token %s", tok))
		}

		// Create the new parse tree and register it inside of this one for
		// later reference.
		newT := &ParseTree{}
		if t.Tokens == nil {
			t.Tokens = make(map[Token]*ParseTree)
		}
		t.Tokens[tok] = newT
		t.Keys = append(t.Keys, tok.String())
		t = newT
	}
	return t
}

// Handle registers a handler to be invoked when seeing the given token.
func (t *ParseTree) Handle(tok Token, fn func(*Parser) (Statement, error)) {
	// Verify that there is no conflict for this token in this parse tree.
	if _, conflict := t.Tokens[tok]; conflict {
		panic(fmt.Sprintf("conflict for token %s", tok))
	}

	if _, conflict := t.Handlers[tok]; conflict {
		panic(fmt.Sprintf("conflict for token %s", tok))
	}

	if t.Handlers == nil {
		t.Handlers = make(map[Token]func(*Parser) (Statement, error))
	}
	t.Handlers[tok] = fn
	t.Keys = append(t.Keys, tok.String())
}

// Parse parses a statement using the language defined in the parse tree.
func (t *ParseTree) Parse(p *Parser) (Statement, error) {
	for {
		tok, pos, lit := p.ScanIgnoreWhitespace()
		if subtree := t.Tokens[tok]; subtree != nil {
			t = subtree
			continue
		}

		if stmt := t.Handlers[tok]; stmt != nil {
			return stmt(p)
		}

		// There were no registered handlers. Return the valid tokens in the order they were added.
		return nil, newParseError(tokstr(tok, lit), t.Keys, pos)
	}
}

func (t *ParseTree) Clone() *ParseTree {
	newT := &ParseTree{}
	if t.Handlers != nil {
		newT.Handlers = make(map[Token]func(*Parser) (Statement, error), len(t.Handlers))
		for tok, handler := range t.Handlers {
			newT.Handlers[tok] = handler
		}
	}

	if t.Tokens != nil {
		newT.Tokens = make(map[Token]*ParseTree, len(t.Tokens))
		for tok, subtree := range t.Tokens {
			newT.Tokens[tok] = subtree.Clone()
		}
	}
	return newT
}

func init() {
	Language.Handle(SELECT, func(p *Parser) (Statement, error) {
		return p.parseSelectStatement(targetNotRequired)
	})
	Language.Handle(DELETE, func(p *Parser) (Statement, error) {
		return p.parseDeleteStatement()
	})
	Language.Group(SHOW).With(func(show *ParseTree) {
		show.Group(CONTINUOUS).Handle(QUERIES, func(p *Parser) (Statement, error) {
			return p.parseShowContinuousQueriesStatement()
		})
		show.Handle(DATABASES, func(p *Parser) (Statement, error) {
			return p.parseShowDatabasesStatement()
		})
		show.Handle(DIAGNOSTICS, func(p *Parser) (Statement, error) {
			return p.parseShowDiagnosticsStatement()
		})
		show.Group(FIELD).With(func(field *ParseTree) {
			field.Handle(KEY, func(p *Parser) (Statement, error) {
				return p.parseShowFieldKeyCardinalityStatement()
			})
			field.Handle(KEYS, func(p *Parser) (Statement, error) {
				return p.parseShowFieldKeysStatement()
			})
		})
		show.Group(GRANTS).Handle(FOR, func(p *Parser) (Statement, error) {
			return p.parseGrantsForUserStatement()
		})
		show.Group(MEASUREMENT).Handle(EXACT, func(p *Parser) (Statement, error) {
			return p.parseShowMeasurementCardinalityStatement(true)
		})
		show.Group(MEASUREMENT).Handle(CARDINALITY, func(p *Parser) (Statement, error) {
			return p.parseShowMeasurementCardinalityStatement(false)
		})
		show.Handle(MEASUREMENTS, func(p *Parser) (Statement, error) {
			return p.parseShowMeasurementsStatement()
		})
		show.Handle(QUERIES, func(p *Parser) (Statement, error) {
			return p.parseShowQueriesStatement()
		})
		show.Group(RETENTION).Handle(POLICIES, func(p *Parser) (Statement, error) {
			return p.parseShowRetentionPoliciesStatement()
		})
		show.Handle(SERIES, func(p *Parser) (Statement, error) {
			return p.parseShowSeriesStatement()
		})
		show.Group(SHARD).Handle(GROUPS, func(p *Parser) (Statement, error) {
			return p.parseShowShardGroupsStatement()
		})
		show.Handle(SHARDS, func(p *Parser) (Statement, error) {
			return p.parseShowShardsStatement()
		})
		show.Handle(STATS, func(p *Parser) (Statement, error) {
			return p.parseShowStatsStatement()
		})
		show.Handle(SUBSCRIPTIONS, func(p *Parser) (Statement, error) {
			return p.parseShowSubscriptionsStatement()
		})
		show.Group(TAG).With(func(tag *ParseTree) {
			tag.Handle(KEY, func(p *Parser) (Statement, error) {
				return p.parseShowTagKeyCardinalityStatement()
			})
			tag.Handle(KEYS, func(p *Parser) (Statement, error) {
				return p.parseShowTagKeysStatement()
			})
			tag.Handle(VALUES, func(p *Parser) (Statement, error) {
				return p.parseShowTagValuesStatement()
			})
		})
		show.Handle(USERS, func(p *Parser) (Statement, error) {
			return p.parseShowUsersStatement()
		})
	})
	Language.Group(CREATE).With(func(create *ParseTree) {
		create.Group(CONTINUOUS).Handle(QUERY, func(p *Parser) (Statement, error) {
			return p.parseCreateContinuousQueryStatement()
		})
		create.Handle(DATABASE, func(p *Parser) (Statement, error) {
			return p.parseCreateDatabaseStatement()
		})
		create.Handle(USER, func(p *Parser) (Statement, error) {
			return p.parseCreateUserStatement()
		})
		create.Group(RETENTION).Handle(POLICY, func(p *Parser) (Statement, error) {
			return p.parseCreateRetentionPolicyStatement()
		})
		create.Handle(SUBSCRIPTION, func(p *Parser) (Statement, error) {
			return p.parseCreateSubscriptionStatement()
		})
	})
	Language.Group(DROP).With(func(drop *ParseTree) {
		drop.Group(CONTINUOUS).Handle(QUERY, func(p *Parser) (Statement, error) {
			return p.parseDropContinuousQueryStatement()
		})
		drop.Handle(DATABASE, func(p *Parser) (Statement, error) {
			return p.parseDropDatabaseStatement()
		})
		drop.Handle(MEASUREMENT, func(p *Parser) (Statement, error) {
			return p.parseDropMeasurementStatement()
		})
		drop.Group(RETENTION).Handle(POLICY, func(p *Parser) (Statement, error) {
			return p.parseDropRetentionPolicyStatement()
		})
		drop.Handle(SERIES, func(p *Parser) (Statement, error) {
			return p.parseDropSeriesStatement()
		})
		drop.Handle(SHARD, func(p *Parser) (Statement, error) {
			return p.parseDropShardStatement()
		})
		drop.Handle(SUBSCRIPTION, func(p *Parser) (Statement, error) {
			return p.parseDropSubscriptionStatement()
		})
		drop.Handle(USER, func(p *Parser) (Statement, error) {
			return p.parseDropUserStatement()
		})
	})
	Language.Handle(EXPLAIN, func(p *Parser) (Statement, error) {
		return p.parseExplainStatement()
	})
	Language.Handle(GRANT, func(p *Parser) (Statement, error) {
		return p.parseGrantStatement()
	})
	Language.Handle(REVOKE, func(p *Parser) (Statement, error) {
		return p.parseRevokeStatement()
	})
	Language.Group(ALTER, RETENTION).Handle(POLICY, func(p *Parser) (Statement, error) {
		return p.parseAlterRetentionPolicyStatement()
	})
	Language.Group(SET, PASSWORD).Handle(FOR, func(p *Parser) (Statement, error) {
		return p.parseSetPasswordUserStatement()
	})
	Language.Group(KILL).Handle(QUERY, func(p *Parser) (Statement, error) {
		return p.parseKillQueryStatement()
	})
}
