define([
  '../../app/services/graphite/lexer'
], function(Lexer) {

  describe('when lexing graphite expression', function() {

    it('should tokenize metric expression', function() {
      var lexer = new Lexer('metric.test.*.asd.count');
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('metric');
      expect(tokens[1].value).to.be('.');
      expect(tokens[2].type).to.be(Lexer.Token.Identifier);
      expect(tokens[3].type).to.be(Lexer.Token.Punctuator);
    });

    it('should tokenize functions and args', function() {
      var lexer = new Lexer("sum(metric.test, 12, 'test')");
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('sum');
      expect(tokens[0].type).to.be(Lexer.Token.Identifier);
      expect(tokens[1].value).to.be('(');
      expect(tokens[1].type).to.be(Lexer.Token.Punctuator);
      expect(tokens[5].type).to.be(Lexer.Token.Punctuator);
      expect(tokens[5].value).to.be(',');
      expect(tokens[6].type).to.be(Lexer.Token.NumericLiteral);
      expect(tokens[6].value).to.be('12');
      expect(tokens[8].type).to.be(Lexer.Token.StringLiteral);
      expect(tokens[8].value).to.be('test');
    });

  });

});
