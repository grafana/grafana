define([
  './lexer'
], function (Lexer) {
  'use strict';

  function Parser(expression) {
    this.expression = expression;
    this.lexer = new Lexer(expression);
    this.tokens = this.lexer.tokenize();
    this.index = 0;
  }

  Parser.prototype = {

    getAst: function () {
      return this.start();
    },

    start: function () {
      try {
        return this.functionCall() || this.metricExpression();
      }
      catch(e) {
        return {
          type: 'error',
          message: e.message,
          pos: e.pos
        };
      }
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
      };

      this.index++;

      if (this.match('.')) {
        this.index++;
        var rest = this.metricExpression();
        if (!rest) {
          this.errorMark('Expected metric identifier');
        }

        node.segments = node.segments.concat(rest.segments);
      }

      return node;
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
        this.errorMark('Expected closing paranthesis');
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
        value: parseInt(this.tokens[this.index-1].value, 10)
      };
    },

    stringLiteral: function () {
      if (!this.match('string')) {
        return null;
      }

      var token = this.tokens[this.index];
      if (token.isUnclosed) {
        throw { message: 'Unclosed string parameter', pos: token.pos };
      }

      this.index++;

      return {
        type: 'string',
        value: token.value
      };
    },

    errorMark: function(text) {
      var currentToken = this.tokens[this.index];
      var type = currentToken ? currentToken.type : 'end of string';
      throw {
        message: text + " instead found " + type,
        pos: currentToken ? currentToken.pos : this.lexer.char
      };
    },

    matchToken: function(type, index) {
      var token = this.tokens[this.index + index];
      return (token === undefined && type === '') ||
             token && token.type === type;
    },

    match: function(token1, token2) {
      return this.matchToken(token1, 0) &&
        (!token2 || this.matchToken(token2, 1));
    },

  };

  return Parser;
});