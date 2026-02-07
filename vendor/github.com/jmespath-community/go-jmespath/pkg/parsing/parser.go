package parsing

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type astNodeType int

//go:generate stringer -type astNodeType
const (
	ASTEmpty astNodeType = iota
	ASTArithmeticExpression
	ASTArithmeticUnaryExpression
	ASTComparator
	ASTCurrentNode
	ASTRootNode
	ASTExpRef
	ASTFunctionExpression
	ASTField
	ASTFilterProjection
	ASTFlatten
	ASTIdentity
	ASTIndex
	ASTIndexExpression
	ASTKeyValPair
	ASTLiteral
	ASTMultiSelectHash
	ASTMultiSelectList
	ASTOrExpression
	ASTAndExpression
	ASTNotExpression
	ASTPipe
	ASTProjection
	ASTSubexpression
	ASTSlice
	ASTValueProjection
	ASTLetExpression
	ASTVariable
	ASTBindings
	ASTBinding
)

// ASTNode represents the abstract syntax tree of a JMESPath expression.
type ASTNode struct {
	NodeType astNodeType
	Value    interface{}
	Children []ASTNode
}

func (node ASTNode) String() string {
	return node.PrettyPrint(0)
}

// PrettyPrint will pretty print the parsed AST.
// The AST is an implementation detail and this pretty print
// function is provided as a convenience method to help with
// debugging.  You should not rely on its output as the internal
// structure of the AST may change at any time.
func (node ASTNode) PrettyPrint(indent int) string {
	spaces := strings.Repeat(" ", indent)
	output := fmt.Sprintf("%s%s {\n", spaces, node.NodeType)
	nextIndent := indent + 2
	if node.Value != nil {
		if converted, ok := node.Value.(fmt.Stringer); ok {
			// Account for things like comparator nodes
			// that are enums with a String() method.
			output += fmt.Sprintf("%svalue: %s\n", strings.Repeat(" ", nextIndent), converted.String())
		} else {
			output += fmt.Sprintf("%svalue: %#v\n", strings.Repeat(" ", nextIndent), node.Value)
		}
	}
	lastIndex := len(node.Children)
	if lastIndex > 0 {
		output += fmt.Sprintf("%schildren: {\n", strings.Repeat(" ", nextIndent))
		childIndent := nextIndent + 2
		for _, elem := range node.Children {
			output += elem.PrettyPrint(childIndent)
		}
		output += fmt.Sprintf("%s}\n", strings.Repeat(" ", nextIndent))
	}
	output += fmt.Sprintf("%s}\n", spaces)
	return output
}

var bindingPowers = map[TokType]int{
	TOKEOF:                0,
	TOKVarref:             0,
	TOKUnquotedIdentifier: 0,
	TOKQuotedIdentifier:   0,
	TOKRbracket:           0,
	TOKRparen:             0,
	TOKComma:              0,
	TOKRbrace:             0,
	TOKNumber:             0,
	TOKCurrent:            0,
	TOKExpref:             0,
	TOKColon:              0,
	TOKAssign:             1,
	TOKPipe:               1,
	TOKOr:                 2,
	TOKAnd:                3,
	TOKEQ:                 5,
	TOKLT:                 5,
	TOKLTE:                5,
	TOKGT:                 5,
	TOKGTE:                5,
	TOKNE:                 5,
	TOKMinus:              6,
	TOKPlus:               6,
	TOKDiv:                7,
	TOKDivide:             7,
	TOKModulo:             7,
	TOKMultiply:           7,
	TOKFlatten:            9,
	TOKStar:               20,
	TOKFilter:             21,
	TOKDot:                40,
	TOKNot:                45,
	TOKLbrace:             50,
	TOKLbracket:           55,
	TOKLparen:             60,
}

// Parser holds state about the current expression being parsed.
type Parser struct {
	expression string
	tokens     []token
	index      int
}

// NewParser creates a new JMESPath parser.
func NewParser() *Parser {
	p := Parser{}
	return &p
}

// Parse will compile a JMESPath expression.
func (p *Parser) Parse(expression string) (ASTNode, error) {
	lexer := NewLexer()
	p.expression = expression
	tokens, err := lexer.Tokenize(expression)
	if err != nil {
		return ASTNode{}, err
	}
	return p.parseTokens(tokens)
}

func (p *Parser) parseTokens(tokens []token) (ASTNode, error) {
	p.tokens = tokens
	p.index = 0
	parsed, err := p.parseExpression(0)
	if err != nil {
		return ASTNode{}, err
	}
	if p.current() != TOKEOF {
		return ASTNode{}, p.syntaxError(fmt.Sprintf(
			"Unexpected token at the end of the expression: %s", p.current()))
	}
	return parsed, nil
}

func (p *Parser) parseExpression(bindingPower int) (ASTNode, error) {
	var err error
	leftToken := p.lookaheadToken(0)
	p.advance()
	leftNode, err := p.nud(leftToken)
	if err != nil {
		return ASTNode{}, err
	}
	currentToken := p.current()
	for bindingPower < bindingPowers[currentToken] {
		p.advance()
		leftNode, err = p.led(currentToken, leftNode)
		if err != nil {
			return ASTNode{}, err
		}
		currentToken = p.current()
	}
	return leftNode, nil
}

func (p *Parser) parseIndexExpression() (ASTNode, error) {
	if p.lookahead(0) == TOKColon || p.lookahead(1) == TOKColon {
		return p.parseSliceExpression()
	}
	indexStr := p.lookaheadToken(0).value
	parsedInt, err := strconv.Atoi(indexStr)
	if err != nil {
		return ASTNode{}, err
	}
	indexNode := ASTNode{NodeType: ASTIndex, Value: parsedInt}
	p.advance()
	if err := p.match(TOKRbracket); err != nil {
		return ASTNode{}, err
	}
	return indexNode, nil
}

func (p *Parser) parseSliceExpression() (ASTNode, error) {
	parts := []*int{nil, nil, nil}
	index := 0
	current := p.current()
	for current != TOKRbracket && index < 3 {
		if current == TOKColon {
			index++
			if index == 3 {
				return ASTNode{}, p.syntaxErrorToken("Too many colons in slice expression", p.lookaheadToken(0))
			}
			p.advance()
		} else if current == TOKNumber {
			parsedInt, err := strconv.Atoi(p.lookaheadToken(0).value)
			if err != nil {
				return ASTNode{}, err
			}
			parts[index] = &parsedInt
			p.advance()
		} else {
			return ASTNode{}, p.syntaxError(
				"Expected tColon or tNumber" + ", received: " + p.current().String())
		}
		current = p.current()
	}
	if err := p.match(TOKRbracket); err != nil {
		return ASTNode{}, err
	}
	return ASTNode{
		NodeType: ASTSlice,
		Value:    parts,
	}, nil
}

func isKeyword(token token, keyword string) bool {
	return token.tokenType == TOKUnquotedIdentifier && token.value == keyword
}

func (p *Parser) matchKeyword(keyword string) error {
	if isKeyword(p.lookaheadToken(0), keyword) {
		p.advance()
		return nil
	}
	return p.syntaxError("Expected keyword " + keyword + ", received: " + p.current().String())
}

func (p *Parser) match(tokenType TokType) error {
	if p.current() == tokenType {
		p.advance()
		return nil
	}
	return p.syntaxError("Expected " + tokenType.String() + ", received: " + p.current().String())
}

func (p *Parser) led(tokenType TokType, node ASTNode) (ASTNode, error) {
	switch tokenType {
	case TOKDot:
		if p.current() != TOKStar {
			right, err := p.parseDotRHS(bindingPowers[TOKDot])
			return ASTNode{
				NodeType: ASTSubexpression,
				Children: []ASTNode{node, right},
			}, err
		}
		p.advance()
		right, err := p.parseProjectionRHS(bindingPowers[TOKDot])
		return ASTNode{
			NodeType: ASTValueProjection,
			Children: []ASTNode{node, right},
		}, err
	case TOKPipe:
		right, err := p.parseExpression(bindingPowers[TOKPipe])
		return ASTNode{NodeType: ASTPipe, Children: []ASTNode{node, right}}, err
	case TOKOr:
		right, err := p.parseExpression(bindingPowers[TOKOr])
		return ASTNode{NodeType: ASTOrExpression, Children: []ASTNode{node, right}}, err
	case TOKAnd:
		right, err := p.parseExpression(bindingPowers[TOKAnd])
		return ASTNode{NodeType: ASTAndExpression, Children: []ASTNode{node, right}}, err
	case TOKLparen:
		if node.NodeType != ASTField {
			//  0 - first func arg or closing paren.
			// -1 - '(' token
			// -2 - invalid function "name" token.
			return ASTNode{}, p.syntaxErrorToken("Invalid node as function name.", p.lookaheadToken(-2))
		}
		name := node.Value
		args, err := p.parseCommaSeparatedExpressionsUntilToken(TOKRparen)
		if err != nil {
			return ASTNode{}, err
		}
		return ASTNode{
			NodeType: ASTFunctionExpression,
			Value:    name,
			Children: args,
		}, nil
	case TOKFilter:
		return p.parseFilter(node)
	case TOKFlatten:
		left := ASTNode{NodeType: ASTFlatten, Children: []ASTNode{node}}
		right, err := p.parseProjectionRHS(bindingPowers[TOKFlatten])
		return ASTNode{
			NodeType: ASTProjection,
			Children: []ASTNode{left, right},
		}, err
	case TOKPlus, TOKMinus, TOKStar, TOKMultiply, TOKDivide, TOKModulo, TOKDiv:
		right, err := p.parseExpression(bindingPowers[tokenType])
		if err != nil {
			return ASTNode{}, err
		}
		return ASTNode{
			NodeType: ASTArithmeticExpression,
			Value:    tokenType,
			Children: []ASTNode{node, right},
		}, nil
	case TOKAssign:
		{
			right, err := p.parseExpression(bindingPowers[0])
			return ASTNode{
				NodeType: ASTBinding,
				Children: []ASTNode{node, right},
			}, err
		}
	case TOKEQ, TOKNE, TOKGT, TOKGTE, TOKLT, TOKLTE:
		return p.parseComparatorExpression(node, tokenType)
	case TOKLbracket:
		tokenType := p.current()
		var right ASTNode
		var err error
		if tokenType == TOKNumber || tokenType == TOKColon {
			right, err = p.parseIndexExpression()
			if err != nil {
				return ASTNode{}, err
			}
			return p.projectIfSlice(node, right)
		}
		// Otherwise this is a projection.
		if err := p.match(TOKStar); err != nil {
			return ASTNode{}, err
		}
		if err := p.match(TOKRbracket); err != nil {
			return ASTNode{}, err
		}
		right, err = p.parseProjectionRHS(bindingPowers[TOKStar])
		if err != nil {
			return ASTNode{}, err
		}
		return ASTNode{
			NodeType: ASTProjection,
			Children: []ASTNode{node, right},
		}, nil
	}
	return ASTNode{}, p.syntaxError("Unexpected token: " + tokenType.String())
}

func (p *Parser) nud(token token) (ASTNode, error) {
	switch token.tokenType {
	case TOKVarref:
		return ASTNode{
			NodeType: ASTVariable,
			Value:    token.value,
		}, nil
	case TOKJSONLiteral:
		var parsed interface{}
		err := json.Unmarshal([]byte(token.value), &parsed)
		if err != nil {
			return ASTNode{}, err
		}
		return ASTNode{NodeType: ASTLiteral, Value: parsed}, nil
	case TOKStringLiteral:
		return ASTNode{NodeType: ASTLiteral, Value: token.value}, nil
	case TOKUnquotedIdentifier:
		if token.value == "let" && p.current() == TOKVarref {
			return p.parseLetExpression()
		} else {
			return ASTNode{
				NodeType: ASTField,
				Value:    token.value,
			}, nil
		}
	case TOKQuotedIdentifier:
		node := ASTNode{NodeType: ASTField, Value: token.value}
		if p.current() == TOKLparen {
			return ASTNode{}, p.syntaxErrorToken("Can't have quoted identifier as function name.", token)
		}
		return node, nil
	case TOKPlus:
		expr, err := p.parseExpression(bindingPowers[TOKPlus])
		return ASTNode{NodeType: ASTArithmeticUnaryExpression, Value: TOKPlus, Children: []ASTNode{expr}}, err
	case TOKMinus:
		expr, err := p.parseExpression(bindingPowers[TOKMinus])
		return ASTNode{NodeType: ASTArithmeticUnaryExpression, Value: TOKMinus, Children: []ASTNode{expr}}, err
	case TOKStar:
		left := ASTNode{NodeType: ASTIdentity}
		var right ASTNode
		var err error
		if p.current() == TOKRbracket {
			right = ASTNode{NodeType: ASTIdentity}
		} else {
			right, err = p.parseProjectionRHS(bindingPowers[TOKStar])
		}
		return ASTNode{NodeType: ASTValueProjection, Children: []ASTNode{left, right}}, err
	case TOKFilter:
		return p.parseFilter(ASTNode{NodeType: ASTIdentity})
	case TOKLbrace:
		return p.parseMultiSelectHash()
	case TOKFlatten:
		left := ASTNode{
			NodeType: ASTFlatten,
			Children: []ASTNode{{NodeType: ASTIdentity}},
		}
		right, err := p.parseProjectionRHS(bindingPowers[TOKFlatten])
		if err != nil {
			return ASTNode{}, err
		}
		return ASTNode{NodeType: ASTProjection, Children: []ASTNode{left, right}}, nil
	case TOKLbracket:
		tokenType := p.current()

		if tokenType == TOKNumber || tokenType == TOKColon {
			right, err := p.parseIndexExpression()
			if err != nil {
				return ASTNode{}, err
			}
			return p.projectIfSlice(ASTNode{NodeType: ASTIdentity}, right)
		} else if tokenType == TOKStar && p.lookahead(1) == TOKRbracket {
			p.advance()
			p.advance()
			right, err := p.parseProjectionRHS(bindingPowers[TOKStar])
			if err != nil {
				return ASTNode{}, err
			}
			return ASTNode{
				NodeType: ASTProjection,
				Children: []ASTNode{{NodeType: ASTIdentity}, right},
			}, nil
		} else {
			return p.parseMultiSelectList()
		}
	case TOKCurrent:
		return ASTNode{NodeType: ASTCurrentNode}, nil
	case TOKRoot:
		return ASTNode{NodeType: ASTRootNode}, nil
	case TOKExpref:
		expression, err := p.parseExpression(bindingPowers[TOKExpref])
		if err != nil {
			return ASTNode{}, err
		}
		return ASTNode{NodeType: ASTExpRef, Children: []ASTNode{expression}}, nil
	case TOKNot:
		expression, err := p.parseExpression(bindingPowers[TOKNot])
		if err != nil {
			return ASTNode{}, err
		}
		return ASTNode{NodeType: ASTNotExpression, Children: []ASTNode{expression}}, nil
	case TOKLparen:
		expression, err := p.parseExpression(0)
		if err != nil {
			return ASTNode{}, err
		}
		if err := p.match(TOKRparen); err != nil {
			return ASTNode{}, err
		}
		return expression, nil
	case TOKEOF:
		return ASTNode{}, p.syntaxErrorToken("Incomplete expression", token)
	}

	return ASTNode{}, p.syntaxErrorToken("Invalid token: "+token.tokenType.String(), token)
}

func (p *Parser) parseMultiSelectList() (ASTNode, error) {
	var expressions []ASTNode
	for {
		expression, err := p.parseExpression(0)
		if err != nil {
			return ASTNode{}, err
		}
		expressions = append(expressions, expression)
		if p.current() == TOKRbracket {
			break
		}
		err = p.match(TOKComma)
		if err != nil {
			return ASTNode{}, err
		}
	}
	err := p.match(TOKRbracket)
	if err != nil {
		return ASTNode{}, err
	}
	return ASTNode{
		NodeType: ASTMultiSelectList,
		Children: expressions,
	}, nil
}

func (p *Parser) parseMultiSelectHash() (ASTNode, error) {
	var children []ASTNode
	for {
		keyToken := p.lookaheadToken(0)
		if err := p.match(TOKUnquotedIdentifier); err != nil {
			if err := p.match(TOKQuotedIdentifier); err != nil {
				return ASTNode{}, p.syntaxError("Expected tQuotedIdentifier or tUnquotedIdentifier")
			}
		}
		keyName := keyToken.value
		err := p.match(TOKColon)
		if err != nil {
			return ASTNode{}, err
		}
		value, err := p.parseExpression(0)
		if err != nil {
			return ASTNode{}, err
		}
		node := ASTNode{
			NodeType: ASTKeyValPair,
			Value:    keyName,
			Children: []ASTNode{value},
		}
		children = append(children, node)
		if p.current() == TOKComma {
			err := p.match(TOKComma)
			if err != nil {
				return ASTNode{}, nil
			}
		} else if p.current() == TOKRbrace {
			err := p.match(TOKRbrace)
			if err != nil {
				return ASTNode{}, nil
			}
			break
		}
	}
	return ASTNode{
		NodeType: ASTMultiSelectHash,
		Children: children,
	}, nil
}

func (p *Parser) projectIfSlice(left ASTNode, right ASTNode) (ASTNode, error) {
	indexExpr := ASTNode{
		NodeType: ASTIndexExpression,
		Children: []ASTNode{left, right},
	}
	if right.NodeType == ASTSlice {
		right, err := p.parseProjectionRHS(bindingPowers[TOKStar])
		return ASTNode{
			NodeType: ASTProjection,
			Children: []ASTNode{indexExpr, right},
		}, err
	}
	return indexExpr, nil
}

func (p *Parser) parseFilter(node ASTNode) (ASTNode, error) {
	var right, condition ASTNode
	var err error
	condition, err = p.parseExpression(0)
	if err != nil {
		return ASTNode{}, err
	}
	if err := p.match(TOKRbracket); err != nil {
		return ASTNode{}, err
	}
	if p.current() == TOKFlatten {
		right = ASTNode{NodeType: ASTIdentity}
	} else {
		right, err = p.parseProjectionRHS(bindingPowers[TOKFilter])
		if err != nil {
			return ASTNode{}, err
		}
	}

	return ASTNode{
		NodeType: ASTFilterProjection,
		Children: []ASTNode{node, right, condition},
	}, nil
}

func (p *Parser) parseDotRHS(bindingPower int) (ASTNode, error) {
	lookahead := p.current()
	if tokensOneOf([]TokType{TOKQuotedIdentifier, TOKUnquotedIdentifier, TOKStar}, lookahead) {
		return p.parseExpression(bindingPower)
	} else if lookahead == TOKLbracket {
		if err := p.match(TOKLbracket); err != nil {
			return ASTNode{}, err
		}
		return p.parseMultiSelectList()
	} else if lookahead == TOKLbrace {
		if err := p.match(TOKLbrace); err != nil {
			return ASTNode{}, err
		}
		return p.parseMultiSelectHash()
	}
	return ASTNode{}, p.syntaxError("Expected identifier, lbracket, or lbrace")
}

func (p *Parser) parseProjectionRHS(bindingPower int) (ASTNode, error) {
	current := p.current()
	if bindingPowers[current] < 10 {
		return ASTNode{NodeType: ASTIdentity}, nil
	} else if current == TOKLbracket {
		return p.parseExpression(bindingPower)
	} else if current == TOKFilter {
		return p.parseExpression(bindingPower)
	} else if current == TOKDot {
		err := p.match(TOKDot)
		if err != nil {
			return ASTNode{}, err
		}
		return p.parseDotRHS(bindingPower)
	} else {
		return ASTNode{}, p.syntaxError("Error")
	}
}

func (p *Parser) parseLetExpression() (ASTNode, error) {
	bindings, err := p.parseCommaSeparatedExpressionsUntilKeyword("in")
	if err != nil {
		return ASTNode{}, err
	}
	expression, err := p.parseExpression(0)
	if err != nil {
		return ASTNode{}, err
	}
	return ASTNode{
		NodeType: ASTLetExpression,
		Children: []ASTNode{
			{
				NodeType: ASTBindings,
				Children: bindings,
			},
			expression,
		},
	}, nil
}

func (p *Parser) parseCommaSeparatedExpressionsUntilKeyword(keyword string) ([]ASTNode, error) {
	return p.parseCommaSeparatedExpressionsUntil(
		func() bool {
			return isKeyword(p.lookaheadToken(0), keyword)
		},
		func() error { return p.matchKeyword(keyword) })
}

func (p *Parser) parseCommaSeparatedExpressionsUntilToken(endToken TokType) ([]ASTNode, error) {
	return p.parseCommaSeparatedExpressionsUntil(
		func() bool { return p.current() == endToken },
		func() error { return p.match(endToken) })
}

func (p *Parser) parseCommaSeparatedExpressionsUntil(isEndToken func() bool, matchEndToken func() error) ([]ASTNode, error) {
	var nodes []ASTNode
	for !isEndToken() {
		expression, err := p.parseExpression(0)
		if err != nil {
			return []ASTNode{}, err
		}
		if p.current() == TOKComma {
			if err := p.match(TOKComma); err != nil {
				return []ASTNode{}, err
			}
		}
		nodes = append(nodes, expression)
	}
	if err := matchEndToken(); err != nil {
		return []ASTNode{}, err
	}
	return nodes, nil
}

func (p *Parser) parseComparatorExpression(left ASTNode, tokenType TokType) (ASTNode, error) {
	right, err := p.parseExpression(bindingPowers[tokenType])
	if err != nil {
		return ASTNode{}, err
	}
	return ASTNode{
		NodeType: ASTComparator,
		Value:    tokenType,
		Children: []ASTNode{left, right},
	}, nil
}

func (p *Parser) lookahead(number int) TokType {
	return p.lookaheadToken(number).tokenType
}

func (p *Parser) current() TokType {
	return p.lookahead(0)
}

func (p *Parser) lookaheadToken(number int) token {
	return p.tokens[p.index+number]
}

func (p *Parser) advance() {
	p.index++
}

func tokensOneOf(elements []TokType, token TokType) bool {
	for _, elem := range elements {
		if elem == token {
			return true
		}
	}
	return false
}

func (p *Parser) syntaxError(msg string) SyntaxError {
	return SyntaxError{
		msg:        msg,
		Expression: p.expression,
		Offset:     p.lookaheadToken(0).position,
	}
}

// Create a SyntaxError based on the provided token.
// This differs from syntaxError() which creates a SyntaxError
// based on the current lookahead token.
func (p *Parser) syntaxErrorToken(msg string, t token) SyntaxError {
	return SyntaxError{
		msg:        msg,
		Expression: p.expression,
		Offset:     t.position,
	}
}
