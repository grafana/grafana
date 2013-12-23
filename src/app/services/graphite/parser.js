define([
  './lexer'
], function (Lexer) {

  var NodeTypes = {
    MetricExpression = 1,
    MetricNode: 2,
    FunctionCall: 4
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

  Parser.prototype = {
      getAst: function () {
        return parse('start');
      },

      checkToken: function (token, expected) {
        if (token === null) {
          this.error = "Expected token: " + expected + " instead found end of string";
          return;
        }

        if (token.type === expected) {
          return true;
        }

        this.error = "Expected  token "
            + expected + " instead found + "
            found + " at position: " + lexer.char;

        return false;
      },

      parse: function (state) {
        var node = { children: [] };

        var token = lexer.next();
        var nextToken = lexer.next();

        if (checkToken(token, Lexer.Token.Identifier) {
          return null;
        }

        if (nextToken == null) {
          return {
            type: NodeTypes.MetricExpression,
            nodes: [
              {
                type: NodeTypes.MetricNode,
                value: token.value
              }
            ]
          }
        }

        if (checkToken(nextToken, Lexer.Token.Punctuator)) {
          return null;
        }

        if (nextToken.value === '.') {
          return parseMetricExpression(token);
        }
      },

      parseMetricExpression: function(firstToken) {
        var node = {
          type: NodeTypes.MetricExpression,
          nodes: [
            {
              type: NodeTypes.MetricNode,
              value: firstToken.value
            }
          ]
        };

        var token;

        while(true) {
          token = lexer.nextToken();
          if (checkToken(token, Lexer.Token.Identifier)) {
            return null;
          }

        }
      }
        /*while(true) {
          token = lexer.next();

          switch(state) {

          case "start":
            if (checkToken(token, Lexer.Token.Identifier) {
              return;
            }

            state = "identifier";
            prevToken = token;
            break;

          case "identifier":
            if (token == null) {
              node.type = NodeTypes.MetricExpression;
              node.children.push([
                type: NodeTypes.MetricNode,
                value: prevToken.value;
              ]);

              return node;
            }

            if (checkToken(token, Lexer.Token.Punctuator)) {
              return;
            }

            if (token.value === '.') {
              state = "metricNode";
              node.type = NodeTypes.MetricExpression;
              node.children.push({
                type: NodeTypes.MetricNode,
                value: prevToken.value
              });
            }

            if (token.value === '(') {
              state = 'function';
            }

            break;
          case 'metricEnd':
            if (token === null) {
              return node;
            }

            if (checkToken(token, Lexer.Token.Punctuator)) {
              return null;
            }

          case 'metricNode':
            if (checkToken(token, Lexer.Token.Identifier)) {
              return null;
            }

            node.children.push([
              type: NodeTypes.MetricNode,
              value: token.value
            ]);

            state = 'metricEnd';
            break;
          }
        }
      }*/
  };

  return Parser;
});