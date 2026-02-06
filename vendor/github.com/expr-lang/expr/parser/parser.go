package parser

import (
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"

	. "github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/builtin"
	"github.com/expr-lang/expr/conf"
	"github.com/expr-lang/expr/file"
	. "github.com/expr-lang/expr/parser/lexer"
	"github.com/expr-lang/expr/parser/operator"
	"github.com/expr-lang/expr/parser/utils"
)

type arg byte

const (
	expr arg = 1 << iota
	predicate
)

const optional arg = 1 << 7

var predicates = map[string]struct {
	args []arg
}{
	"all":           {[]arg{expr, predicate}},
	"none":          {[]arg{expr, predicate}},
	"any":           {[]arg{expr, predicate}},
	"one":           {[]arg{expr, predicate}},
	"filter":        {[]arg{expr, predicate}},
	"map":           {[]arg{expr, predicate}},
	"count":         {[]arg{expr, predicate | optional}},
	"sum":           {[]arg{expr, predicate | optional}},
	"find":          {[]arg{expr, predicate}},
	"findIndex":     {[]arg{expr, predicate}},
	"findLast":      {[]arg{expr, predicate}},
	"findLastIndex": {[]arg{expr, predicate}},
	"groupBy":       {[]arg{expr, predicate}},
	"sortBy":        {[]arg{expr, predicate, expr | optional}},
	"reduce":        {[]arg{expr, predicate, expr | optional}},
}

// Parser is a reusable parser. The zero value is ready for use.
type Parser struct {
	lexer            *Lexer
	current, stashed Token
	hasStash         bool
	err              *file.Error
	config           *conf.Config
	depth            int  // predicate call depth
	nodeCount        uint // tracks number of AST nodes created
}

func (p *Parser) Parse(input string, config *conf.Config) (*Tree, error) {
	if p.lexer == nil {
		p.lexer = New()
	}
	p.config = config
	// propagate config flags to lexer
	if p.lexer != nil {
		if config != nil {
			p.lexer.DisableIfOperator = config.DisableIfOperator
		} else {
			p.lexer.DisableIfOperator = false
		}
	}
	source := file.NewSource(input)
	p.lexer.Reset(source)
	p.next()
	node := p.parseSequenceExpression()

	if !p.current.Is(EOF) {
		p.error("unexpected token %v", p.current)
	}

	tree := &Tree{
		Node:   node,
		Source: source,
	}
	err := p.err

	// cleanup non-reusable pointer values and reset state
	p.err = nil
	p.config = nil
	p.lexer.Reset(file.Source{})

	if err != nil {
		return tree, err.Bind(source)
	}

	return tree, nil
}

func (p *Parser) checkNodeLimit() error {
	p.nodeCount++
	if p.config == nil {
		if p.nodeCount > conf.DefaultMaxNodes {
			p.error("compilation failed: expression exceeds maximum allowed nodes")
			return nil
		}
		return nil
	}
	if p.config.MaxNodes > 0 && p.nodeCount > p.config.MaxNodes {
		p.error("compilation failed: expression exceeds maximum allowed nodes")
		return nil
	}
	return nil
}

func (p *Parser) createNode(n Node, loc file.Location) Node {
	if err := p.checkNodeLimit(); err != nil {
		return nil
	}
	if n == nil || p.err != nil {
		return nil
	}
	n.SetLocation(loc)
	return n
}

func (p *Parser) createMemberNode(n *MemberNode, loc file.Location) *MemberNode {
	if err := p.checkNodeLimit(); err != nil {
		return nil
	}
	if n == nil || p.err != nil {
		return nil
	}
	n.SetLocation(loc)
	return n
}

type Tree struct {
	Node   Node
	Source file.Source
}

func Parse(input string) (*Tree, error) {
	return ParseWithConfig(input, nil)
}

func ParseWithConfig(input string, config *conf.Config) (*Tree, error) {
	return new(Parser).Parse(input, config)
}

func (p *Parser) error(format string, args ...any) {
	p.errorAt(p.current, format, args...)
}

func (p *Parser) errorAt(token Token, format string, args ...any) {
	if p.err == nil { // show first error
		p.err = &file.Error{
			Location: token.Location,
			Message:  fmt.Sprintf(format, args...),
		}
	}
}

func (p *Parser) next() {
	if p.hasStash {
		p.current = p.stashed
		p.hasStash = false
		return
	}

	token, err := p.lexer.Next()
	var e *file.Error
	switch {
	case err == nil:
		p.current = token
	case errors.Is(err, io.EOF):
		p.error("unexpected end of expression")
	case errors.As(err, &e):
		p.err = e
	default:
		p.err = &file.Error{
			Location: p.current.Location,
			Message:  "unknown lexing error",
			Prev:     err,
		}
	}
}

func (p *Parser) expect(kind Kind, values ...string) {
	if p.current.Is(kind, values...) {
		p.next()
		return
	}
	p.error("unexpected token %v", p.current)
}

// parse functions

func (p *Parser) parseSequenceExpression() Node {
	nodes := []Node{p.parseExpression(0)}

	for p.current.Is(Operator, ";") && p.err == nil {
		p.next()
		// If a trailing semicolon is present, break out.
		if p.current.Is(EOF) {
			break
		}
		nodes = append(nodes, p.parseExpression(0))
	}

	if len(nodes) == 1 {
		return nodes[0]
	}

	return p.createNode(&SequenceNode{
		Nodes: nodes,
	}, nodes[0].Location())
}

func (p *Parser) parseExpression(precedence int) Node {
	if p.err != nil {
		return nil
	}

	if precedence == 0 && p.current.Is(Operator, "let") {
		return p.parseVariableDeclaration()
	}

	if precedence == 0 && (p.config == nil || !p.config.DisableIfOperator) && p.current.Is(Operator, "if") {
		return p.parseConditionalIf()
	}

	nodeLeft := p.parsePrimary()

	prevOperator := ""
	opToken := p.current
	for opToken.Is(Operator) && p.err == nil {
		negate := opToken.Is(Operator, "not")
		var notToken Token

		// Handle "not *" operator, like "not in" or "not contains".
		if negate {
			tokenBackup := p.current
			p.next()
			if operator.AllowedNegateSuffix(p.current.Value) {
				if op, ok := operator.Binary[p.current.Value]; ok && op.Precedence >= precedence {
					notToken = p.current
					opToken = p.current
				} else {
					p.hasStash = true
					p.stashed = p.current
					p.current = tokenBackup
					break
				}
			} else {
				p.error("unexpected token %v", p.current)
				break
			}
		}

		if op, ok := operator.Binary[opToken.Value]; ok && op.Precedence >= precedence {
			p.next()

			if opToken.Value == "|" {
				identToken := p.current
				p.expect(Identifier)
				nodeLeft = p.parseCall(identToken, []Node{nodeLeft}, true)
				goto next
			}

			if prevOperator == "??" && opToken.Value != "??" && !opToken.Is(Bracket, "(") {
				p.errorAt(opToken, "Operator (%v) and coalesce expressions (??) cannot be mixed. Wrap either by parentheses.", opToken.Value)
				break
			}

			if operator.IsComparison(opToken.Value) {
				nodeLeft = p.parseComparison(nodeLeft, opToken, op.Precedence)
				goto next
			}

			var nodeRight Node
			if op.Associativity == operator.Left {
				nodeRight = p.parseExpression(op.Precedence + 1)
			} else {
				nodeRight = p.parseExpression(op.Precedence)
			}

			nodeLeft = p.createNode(&BinaryNode{
				Operator: opToken.Value,
				Left:     nodeLeft,
				Right:    nodeRight,
			}, opToken.Location)
			if nodeLeft == nil {
				return nil
			}

			if negate {
				nodeLeft = p.createNode(&UnaryNode{
					Operator: "not",
					Node:     nodeLeft,
				}, notToken.Location)
				if nodeLeft == nil {
					return nil
				}
			}

			goto next
		}
		break

	next:
		prevOperator = opToken.Value
		opToken = p.current
	}

	if precedence == 0 {
		nodeLeft = p.parseConditional(nodeLeft)
	}

	return nodeLeft
}

func (p *Parser) parseVariableDeclaration() Node {
	p.expect(Operator, "let")
	variableName := p.current
	p.expect(Identifier)
	p.expect(Operator, "=")
	value := p.parseExpression(0)
	p.expect(Operator, ";")
	node := p.parseSequenceExpression()
	return p.createNode(&VariableDeclaratorNode{
		Name:  variableName.Value,
		Value: value,
		Expr:  node,
	}, variableName.Location)
}

func (p *Parser) parseConditionalIf() Node {
	p.next()
	if p.err != nil {
		return nil
	}
	nodeCondition := p.parseExpression(0)
	p.expect(Bracket, "{")
	expr1 := p.parseSequenceExpression()
	p.expect(Bracket, "}")
	p.expect(Operator, "else")

	var expr2 Node
	if p.current.Is(Operator, "if") {
		expr2 = p.parseConditionalIf()
	} else {
		p.expect(Bracket, "{")
		expr2 = p.parseSequenceExpression()
		p.expect(Bracket, "}")
	}

	return &ConditionalNode{
		Cond: nodeCondition,
		Exp1: expr1,
		Exp2: expr2,
	}

}

func (p *Parser) parseConditional(node Node) Node {
	var expr1, expr2 Node
	for p.current.Is(Operator, "?") && p.err == nil {
		p.next()

		if !p.current.Is(Operator, ":") {
			expr1 = p.parseExpression(0)
			p.expect(Operator, ":")
			expr2 = p.parseExpression(0)
		} else {
			p.next()
			expr1 = node
			expr2 = p.parseExpression(0)
		}

		node = p.createNode(&ConditionalNode{
			Ternary: true,
			Cond:    node,
			Exp1:    expr1,
			Exp2:    expr2,
		}, p.current.Location)
		if node == nil {
			return nil
		}
	}
	return node
}

func (p *Parser) parsePrimary() Node {
	token := p.current

	if token.Is(Operator) {
		if op, ok := operator.Unary[token.Value]; ok {
			p.next()
			expr := p.parseExpression(op.Precedence)
			node := p.createNode(&UnaryNode{
				Operator: token.Value,
				Node:     expr,
			}, token.Location)
			if node == nil {
				return nil
			}
			return p.parsePostfixExpression(node)
		}
	}

	if token.Is(Bracket, "(") {
		p.next()
		expr := p.parseSequenceExpression()
		p.expect(Bracket, ")") // "an opened parenthesis is not properly closed"
		return p.parsePostfixExpression(expr)
	}

	if p.depth > 0 {
		if token.Is(Operator, "#") || token.Is(Operator, ".") {
			name := ""
			if token.Is(Operator, "#") {
				p.next()
				if p.current.Is(Identifier) {
					name = p.current.Value
					p.next()
				}
			}
			node := p.createNode(&PointerNode{Name: name}, token.Location)
			if node == nil {
				return nil
			}
			return p.parsePostfixExpression(node)
		}
	}

	if token.Is(Operator, "::") {
		p.next()
		token = p.current
		p.expect(Identifier)
		return p.parsePostfixExpression(p.parseCall(token, []Node{}, false))
	}

	return p.parseSecondary()
}

func (p *Parser) parseSecondary() Node {
	var node Node
	token := p.current

	switch token.Kind {

	case Identifier:
		p.next()
		switch token.Value {
		case "true":
			node = p.createNode(&BoolNode{Value: true}, token.Location)
			if node == nil {
				return nil
			}
			return node
		case "false":
			node = p.createNode(&BoolNode{Value: false}, token.Location)
			if node == nil {
				return nil
			}
			return node
		case "nil":
			node = p.createNode(&NilNode{}, token.Location)
			if node == nil {
				return nil
			}
			return node
		default:
			if p.current.Is(Bracket, "(") {
				node = p.parseCall(token, []Node{}, true)
			} else {
				node = p.createNode(&IdentifierNode{Value: token.Value}, token.Location)
				if node == nil {
					return nil
				}
			}
		}

	case Number:
		p.next()
		value := strings.Replace(token.Value, "_", "", -1)
		var node Node
		valueLower := strings.ToLower(value)
		switch {
		case strings.HasPrefix(valueLower, "0x"):
			number, err := strconv.ParseInt(value, 0, 64)
			if err != nil {
				p.error("invalid hex literal: %v", err)
			}
			node = p.toIntegerNode(number)
		case strings.ContainsAny(valueLower, ".e"):
			number, err := strconv.ParseFloat(value, 64)
			if err != nil {
				p.error("invalid float literal: %v", err)
			}
			node = p.toFloatNode(number)
		case strings.HasPrefix(valueLower, "0b"):
			number, err := strconv.ParseInt(value, 0, 64)
			if err != nil {
				p.error("invalid binary literal: %v", err)
			}
			node = p.toIntegerNode(number)
		case strings.HasPrefix(valueLower, "0o"):
			number, err := strconv.ParseInt(value, 0, 64)
			if err != nil {
				p.error("invalid octal literal: %v", err)
			}
			node = p.toIntegerNode(number)
		default:
			number, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				p.error("invalid integer literal: %v", err)
			}
			node = p.toIntegerNode(number)
		}
		if node != nil {
			node.SetLocation(token.Location)
		}
		return node
	case String:
		p.next()
		node = p.createNode(&StringNode{Value: token.Value}, token.Location)
		if node == nil {
			return nil
		}

	default:
		if token.Is(Bracket, "[") {
			node = p.parseArrayExpression(token)
		} else if token.Is(Bracket, "{") {
			node = p.parseMapExpression(token)
		} else {
			p.error("unexpected token %v", token)
		}
	}

	return p.parsePostfixExpression(node)
}

func (p *Parser) toIntegerNode(number int64) Node {
	if number > math.MaxInt {
		p.error("integer literal is too large")
		return nil
	}
	return p.createNode(&IntegerNode{Value: int(number)}, p.current.Location)
}

func (p *Parser) toFloatNode(number float64) Node {
	if number > math.MaxFloat64 {
		p.error("float literal is too large")
		return nil
	}
	return p.createNode(&FloatNode{Value: number}, p.current.Location)
}

func (p *Parser) parseCall(token Token, arguments []Node, checkOverrides bool) Node {
	var node Node

	isOverridden := false
	if p.config != nil {
		isOverridden = p.config.IsOverridden(token.Value)
	}
	isOverridden = isOverridden && checkOverrides

	if _, ok := predicates[token.Value]; ok && p.config != nil && p.config.Disabled[token.Value] && !isOverridden {
		// Disabled predicate without replacement - fail immediately
		p.error("unknown name %s", token.Value)
	} else if b, ok := predicates[token.Value]; ok && !isOverridden {
		p.expect(Bracket, "(")

		// In case of the pipe operator, the first argument is the left-hand side
		// of the operator, so we do not parse it as an argument inside brackets.
		args := b.args[len(arguments):]

		for i, arg := range args {
			if arg&optional == optional {
				if p.current.Is(Bracket, ")") {
					break
				}
			} else {
				if p.current.Is(Bracket, ")") {
					p.error("expected at least %d arguments", len(args))
				}
			}

			if i > 0 {
				p.expect(Operator, ",")
			}
			var node Node
			switch {
			case arg&expr == expr:
				node = p.parseExpression(0)
			case arg&predicate == predicate:
				node = p.parsePredicate()
			}
			arguments = append(arguments, node)
		}

		// skip last comma
		if p.current.Is(Operator, ",") {
			p.next()
		}
		p.expect(Bracket, ")")

		node = p.createNode(&BuiltinNode{
			Name:      token.Value,
			Arguments: arguments,
		}, token.Location)
		if node == nil {
			return nil
		}
	} else if _, ok := builtin.Index[token.Value]; ok && p.config != nil && p.config.Disabled[token.Value] && !isOverridden {
		// Disabled builtin without replacement - fail immediately
		p.error("unknown name %s", token.Value)
	} else if _, ok := builtin.Index[token.Value]; ok && (p.config == nil || !p.config.Disabled[token.Value]) && !isOverridden {
		node = p.createNode(&BuiltinNode{
			Name:      token.Value,
			Arguments: p.parseArguments(arguments),
		}, token.Location)
		if node == nil {
			return nil
		}

	} else {
		callee := p.createNode(&IdentifierNode{Value: token.Value}, token.Location)
		if callee == nil {
			return nil
		}
		node = p.createNode(&CallNode{
			Callee:    callee,
			Arguments: p.parseArguments(arguments),
		}, token.Location)
		if node == nil {
			return nil
		}
	}
	return node
}

func (p *Parser) parseArguments(arguments []Node) []Node {
	// If pipe operator is used, the first argument is the left-hand side
	// of the operator, so we do not parse it as an argument inside brackets.
	offset := len(arguments)

	p.expect(Bracket, "(")
	for !p.current.Is(Bracket, ")") && p.err == nil {
		if len(arguments) > offset {
			p.expect(Operator, ",")
		}
		if p.current.Is(Bracket, ")") {
			break
		}
		node := p.parseExpression(0)
		arguments = append(arguments, node)
	}
	p.expect(Bracket, ")")

	return arguments
}

func (p *Parser) parsePredicate() Node {
	startToken := p.current
	withBrackets := false
	if p.current.Is(Bracket, "{") {
		p.next()
		withBrackets = true
	}

	p.depth++
	var node Node
	if withBrackets {
		node = p.parseSequenceExpression()
	} else {
		node = p.parseExpression(0)
		if p.current.Is(Operator, ";") {
			p.error("wrap predicate with brackets { and }")
		}
	}
	p.depth--

	if withBrackets {
		p.expect(Bracket, "}")
	}
	predicateNode := p.createNode(&PredicateNode{
		Node: node,
	}, startToken.Location)
	if predicateNode == nil {
		return nil
	}
	return predicateNode
}

func (p *Parser) parseArrayExpression(token Token) Node {
	nodes := make([]Node, 0)

	p.expect(Bracket, "[")
	for !p.current.Is(Bracket, "]") && p.err == nil {
		if len(nodes) > 0 {
			p.expect(Operator, ",")
			if p.current.Is(Bracket, "]") {
				goto end
			}
		}
		node := p.parseExpression(0)
		nodes = append(nodes, node)
	}
end:
	p.expect(Bracket, "]")

	node := p.createNode(&ArrayNode{Nodes: nodes}, token.Location)
	if node == nil {
		return nil
	}
	return node
}

func (p *Parser) parseMapExpression(token Token) Node {
	p.expect(Bracket, "{")

	nodes := make([]Node, 0)
	for !p.current.Is(Bracket, "}") && p.err == nil {
		if len(nodes) > 0 {
			p.expect(Operator, ",")
			if p.current.Is(Bracket, "}") {
				goto end
			}
			if p.current.Is(Operator, ",") {
				p.error("unexpected token %v", p.current)
			}
		}

		var key Node
		// Map key can be one of:
		//  * number
		//  * string
		//  * identifier, which is equivalent to a string
		//  * expression, which must be enclosed in parentheses -- (1 + 2)
		if p.current.Is(Number) || p.current.Is(String) || p.current.Is(Identifier) {
			key = p.createNode(&StringNode{Value: p.current.Value}, p.current.Location)
			if key == nil {
				return nil
			}
			p.next()
		} else if p.current.Is(Bracket, "(") {
			key = p.parseExpression(0)
		} else {
			p.error("a map key must be a quoted string, a number, a identifier, or an expression enclosed in parentheses (unexpected token %v)", p.current)
		}

		p.expect(Operator, ":")

		node := p.parseExpression(0)
		pair := p.createNode(&PairNode{Key: key, Value: node}, token.Location)
		if pair == nil {
			return nil
		}
		nodes = append(nodes, pair)
	}

end:
	p.expect(Bracket, "}")

	node := p.createNode(&MapNode{Pairs: nodes}, token.Location)
	if node == nil {
		return nil
	}
	return node
}

func (p *Parser) parsePostfixExpression(node Node) Node {
	postfixToken := p.current
	for (postfixToken.Is(Operator) || postfixToken.Is(Bracket)) && p.err == nil {
		optional := postfixToken.Value == "?."
	parseToken:
		if postfixToken.Value == "." || postfixToken.Value == "?." {
			p.next()

			propertyToken := p.current
			if optional && propertyToken.Is(Bracket, "[") {
				postfixToken = propertyToken
				goto parseToken
			}
			p.next()

			if propertyToken.Kind != Identifier &&
				// Operators like "not" and "matches" are valid methods or property names.
				(propertyToken.Kind != Operator || !utils.IsValidIdentifier(propertyToken.Value)) {
				p.error("expected name")
			}

			property := p.createNode(&StringNode{Value: propertyToken.Value}, propertyToken.Location)
			if property == nil {
				return nil
			}

			chainNode, isChain := node.(*ChainNode)
			optional := postfixToken.Value == "?."

			if isChain {
				node = chainNode.Node
			}

			memberNode := p.createMemberNode(&MemberNode{
				Node:     node,
				Property: property,
				Optional: optional,
			}, propertyToken.Location)
			if memberNode == nil {
				return nil
			}

			if p.current.Is(Bracket, "(") {
				memberNode.Method = true
				node = p.createNode(&CallNode{
					Callee:    memberNode,
					Arguments: p.parseArguments([]Node{}),
				}, propertyToken.Location)
				if node == nil {
					return nil
				}
			} else {
				node = memberNode
			}

			if isChain || optional {
				node = p.createNode(&ChainNode{Node: node}, propertyToken.Location)
				if node == nil {
					return nil
				}
			}

		} else if postfixToken.Value == "[" {
			p.next()
			var from, to Node

			if p.current.Is(Operator, ":") { // slice without from [:1]
				p.next()

				if !p.current.Is(Bracket, "]") { // slice without from and to [:]
					to = p.parseExpression(0)
				}

				node = p.createNode(&SliceNode{
					Node: node,
					To:   to,
				}, postfixToken.Location)
				if node == nil {
					return nil
				}
				p.expect(Bracket, "]")

			} else {

				from = p.parseExpression(0)

				if p.current.Is(Operator, ":") {
					p.next()

					if !p.current.Is(Bracket, "]") { // slice without to [1:]
						to = p.parseExpression(0)
					}

					node = p.createNode(&SliceNode{
						Node: node,
						From: from,
						To:   to,
					}, postfixToken.Location)
					if node == nil {
						return nil
					}
					p.expect(Bracket, "]")

				} else {
					// Slice operator [:] was not found,
					// it should be just an index node.
					node = p.createNode(&MemberNode{
						Node:     node,
						Property: from,
						Optional: optional,
					}, postfixToken.Location)
					if node == nil {
						return nil
					}
					if optional {
						node = p.createNode(&ChainNode{Node: node}, postfixToken.Location)
						if node == nil {
							return nil
						}
					}
					p.expect(Bracket, "]")
				}
			}
		} else {
			break
		}
		postfixToken = p.current
	}
	return node
}
func (p *Parser) parseComparison(left Node, token Token, precedence int) Node {
	var rootNode Node
	for {
		comparator := p.parseExpression(precedence + 1)
		cmpNode := p.createNode(&BinaryNode{
			Operator: token.Value,
			Left:     left,
			Right:    comparator,
		}, token.Location)
		if cmpNode == nil {
			return nil
		}
		if rootNode == nil {
			rootNode = cmpNode
		} else {
			rootNode = p.createNode(&BinaryNode{
				Operator: "&&",
				Left:     rootNode,
				Right:    cmpNode,
			}, token.Location)
			if rootNode == nil {
				return nil
			}
		}

		left = comparator
		token = p.current
		if !(token.Is(Operator) && operator.IsComparison(token.Value) && p.err == nil) {
			break
		}
		p.next()
	}
	return rootNode
}
