define([
  './lexer'
], function (Lexer) {

  var NodeTypes = {
    MetricExpression: 1,
    MetricNode: 2,
    FunctionCall: 4,
    NumericLiteral: 5,
    StringLiteral: 6
  };

  function Node(type, value) {
    this.type = type;
    this.value = value;
  }

  function Parser(expression) {
    this.expression = expression;
    this.lexer = new Lexer(expression);
    this.state = "start";
    this.error = null;
  }

  Parser.Nodes = NodeTypes;

  Parser.prototype = {
      getAst: function () {
        return this.parse('start');
      },

      isUnexpectedToken: function (expected, value) {
        if (this.token === null) {
          this.error = "Expected token: " + expected + " instead found end of string";
          return true;
        }

        if (this.token.type === expected) {
          return false;
        }

        if (value && this.token.value === value) {
          return false;
        }

        this.error = "Expected  token " + expected +
            ' instead found token ' + this.token.type +
            ' ("'  + this.token.value + '")' +
            " at position: " + this.lexer.char;

        return true;
      },

      parse: function (state, allowParams) {
        var node = { };

        while(true) {
          this.token = this.lexer.next();

          switch(state) {
          case "start":
            if (allowParams) {
              if (this.token === null) {
                return null;
              }

              if (this.token.type === Lexer.Token.NumericLiteral) {
                return {
                  type: NodeTypes.NumericLiteral,
                  value: parseInt(this.token.value)
                };
              }

              if (this.token.type === Lexer.Token.StringLiteral) {
                return {
                  type: NodeTypes.StringLiteral,
                  value: this.token.value
                };
              }
            }

            if (this.isUnexpectedToken(Lexer.Token.Identifier)) {
              return;
            }

            state = "identifier";
            this.prevToken = this.token;
            break;

          case "identifier":
            if (this.token == null || (allowParams && this.token.value === ',')) {
              return {
                type: NodeTypes.MetricExpression,
                segments: [{
                    type: NodeTypes.MetricExpression,
                    value: this.prevToken.value
                }]
              };
            }

            if (this.isUnexpectedToken(Lexer.Token.Punctuator)) {
              return null;
            }

            if (this.token.value === '.') {
              state = "metricNode";
              node.type = NodeTypes.MetricExpression;
              node.segments = [{
                type: NodeTypes.MetricNode,
                value: this.prevToken.value
              }];

              continue;
            }

            if (this.token.value === '(') {
              node.type = NodeTypes.FunctionCall;
              node.name = this.prevToken.value;
              node.params = this.parseFunc();
              return node;
            }

            if (this.token.value === ')') {
              return node;
            }

            break;

          case 'metricEnd':
            if (this.token === null) {
              return node;
            }

            if (this.isUnexpectedToken(Lexer.Token.Punctuator)) {
              return null;
            }

            if (this.token.value === '.') {
              state = 'metricNode';
            }

            if (allowParams && (this.token.value === ',' || this.token.value === ')')) {
              return node;
            }

            break;
          case 'metricNode':
            if (this.isUnexpectedToken(Lexer.Token.Identifier)) {
              return null;
            }

            node.segments.push({
              type: NodeTypes.MetricNode,
              value: this.token.value
            });

            state = 'metricEnd';
            break;
          default:
            this.error = 'unknown token: ' + this.token.type;
          }
        }
      },

      parseFunc: function() {
        var arguments = [];
        var arg;

        while(true) {

          arg = this.parse('start', true);
          if (arg === null) {
            this.error = "expected function arguments";
            return null;
          }

          arguments.push(arg);

          if (this.token === null) {
            this.error = "expected closing function at position: " + this.lexer.char;
            return null;
          }

          if (this.token.value === ')') {
            return arguments;
          }

          if (this.token.type === Lexer.Token.NumericLiteral ||
              this.token.type === Lexer.Token.StringLiteral) {
            this.token = this.lexer.next();
          }

          if (this.isUnexpectedToken(Lexer.Token.Punctuator, ',')) {
            return null;
          }

          if (this.token.value === ')') {
            return arguments;
          }
        }

      }
  };

  return Parser;
});