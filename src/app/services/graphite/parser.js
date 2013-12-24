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
    this.tokens = this.lexer.tokenize();
    this.index = 0;
  }

  Parser.Nodes = NodeTypes;

  Parser.prototype = {

    getAst: function () {
      return this.start();
    },

    start: function () {
      return this.functionCall() || this.metricExpression();
    },

    metricExpression: function() {
      if (!this.match('identifier')) {
        return null;
      }

      var node = {
        type: 'metric',
        segments: [{
          type: 'segment',
          value: this.tokens[this.index].value
        }]
      }

      this.index++;

      if (this.match('.')) {
        this.index++;
        var rest = this.metricExpression();
        node.segments = node.segments.concat(rest.segments)
      }

      return node;
    },

    matchToken: function(type, index) {
      var token = this.tokens[this.index + index];
      return (token === undefined && type === '') ||
             token && token.type === type;
    },

    match: function(token1, token2) {
      return this.matchToken(token1, 0) &&
        (!token2 || this.matchToken(token2, 1))
    },

    functionCall: function() {
      if (!this.match('identifier', '(')) {
        return null;
      }

      var node = {
        type: 'function',
        name: this.tokens[this.index].value,
      };

      this.index += 2;

      node.params = this.functionParameters();

      if (!this.match(')')) {
        this.error = 'missing closing paranthesis';
        return null;
      }

      this.index++;

      return node;
    },

    functionParameters: function () {
      if (this.match(')') || this.match('')) {
        return [];
      }

      var param =
        this.functionCall() ||
        this.metricExpression() ||
        this.numericLiteral() ||
        this.stringLiteral();

      if (!this.match(',')) {
        return [param];
      }

      this.index++;
      return [param].concat(this.functionParameters());
    },

    numericLiteral: function () {
      if (!this.match('number')) {
        return null;
      }

      this.index++;

      return {
        type: 'number',
        value: this.tokens[this.index-1].value
      };
    },

    stringLiteral: function () {
      if (!this.match('string')) {
        return null;
      }

      this.index++;

      return {
        type: 'string',
        value: this.tokens[this.index-1].value
      };
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
  };

  return Parser;
});