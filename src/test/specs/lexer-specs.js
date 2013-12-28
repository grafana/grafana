define([
  '../../app/services/graphite/lexer'
], function(Lexer) {

  describe('when lexing graphite expression', function() {

    it('should tokenize metric expression', function() {
      var lexer = new Lexer('metric.test.*.asd.count');
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('metric');
      expect(tokens[1].value).to.be('.');
      expect(tokens[2].type).to.be('identifier');
      expect(tokens[4].type).to.be('identifier');
      expect(tokens[4].pos).to.be(13);
    });

    it('should tokenize functions and args', function() {
      var lexer = new Lexer("sum(metric.test, 12, 'test')");
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('sum');
      expect(tokens[0].type).to.be('identifier');
      expect(tokens[1].value).to.be('(');
      expect(tokens[1].type).to.be('(');
      expect(tokens[5].type).to.be(',');
      expect(tokens[5].value).to.be(',');
      expect(tokens[6].type).to.be('number');
      expect(tokens[6].value).to.be('12');
      expect(tokens[8].type).to.be('string');
      expect(tokens[8].value).to.be('test');
      expect(tokens[tokens.length - 1].value).to.be(')');
    });

    it('should handle error with unterminated string', function() {
      var lexer = new Lexer("alias(metric, 'asd)");
      var tokens = lexer.tokenize();
      expect(tokens[0].value).to.be('alias');
      expect(tokens[1].value).to.be('(');
      expect(tokens[2].value).to.be('metric');
      expect(tokens[3].value).to.be(',');
      expect(tokens[4].type).to.be('string');
      expect(tokens[4].isUnclosed).to.be(true);
      expect(tokens[4].pos).to.be(20);
    });


  });

});
