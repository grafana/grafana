define([
  '../../app/services/graphite/Parser'
], function(Parser) {

  describe('when parsing graphite expression', function() {

    it('should return ast', function() {
      var parser = new Parser('metric.test.*.asd.count');
      var ast = parser.getAst();
      expect(ast[0].type).to.be(Parser.Nodes.MetricExpression);
      expect(ast[0].nodes.length).to.be(5);
      expect(ast[0].nodes[0].value).to.be('metric');

    });


  });

});
