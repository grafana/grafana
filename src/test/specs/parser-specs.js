define([
  'plugins/datasource/graphite/parser'
], function(Parser) {
  'use strict';

  describe('when parsing', function() {

    it('simple metric expression', function() {
      var parser = new Parser('metric.test.*.asd.count');
      var rootNode = parser.getAst();

      expect(rootNode.type).to.be('metric');
      expect(rootNode.segments.length).to.be(5);
      expect(rootNode.segments[0].value).to.be('metric');
    });

    it('simple metric expression with numbers in segments', function() {
      var parser = new Parser('metric.10.15_20.5');
      var rootNode = parser.getAst();

      expect(rootNode.type).to.be('metric');
      expect(rootNode.segments.length).to.be(4);
      expect(rootNode.segments[1].value).to.be('10');
      expect(rootNode.segments[2].value).to.be('15_20');
      expect(rootNode.segments[3].value).to.be('5');
    });

    it('simple metric expression with curly braces', function() {
      var parser = new Parser('metric.se1-{count, max}');
      var rootNode = parser.getAst();

      expect(rootNode.type).to.be('metric');
      expect(rootNode.segments.length).to.be(2);
      expect(rootNode.segments[1].value).to.be('se1-{count,max}');
    });

    it('simple metric expression with curly braces at start of segment and with post chars', function() {
      var parser = new Parser('metric.{count, max}-something.count');
      var rootNode = parser.getAst();

      expect(rootNode.type).to.be('metric');
      expect(rootNode.segments.length).to.be(3);
      expect(rootNode.segments[1].value).to.be('{count,max}-something');
    });

    it('simple function', function() {
      var parser = new Parser('sum(test)');
      var rootNode = parser.getAst();
      expect(rootNode.type).to.be('function');
      expect(rootNode.params.length).to.be(1);
    });

    it('simple function2', function() {
      var parser = new Parser('offset(test.metric, -100)');
      var rootNode = parser.getAst();
      expect(rootNode.type).to.be('function');
      expect(rootNode.params[0].type).to.be('metric');
      expect(rootNode.params[1].type).to.be('number');
    });

    it('simple function with string arg', function() {
      var parser = new Parser("randomWalk('test')");
      var rootNode = parser.getAst();
      expect(rootNode.type).to.be('function');
      expect(rootNode.params.length).to.be(1);
      expect(rootNode.params[0].type).to.be('string');
    });

    it('function with multiple args', function() {
      var parser = new Parser("sum(test, 1, 'test')");
      var rootNode = parser.getAst();

      expect(rootNode.type).to.be('function');
      expect(rootNode.params.length).to.be(3);
      expect(rootNode.params[0].type).to.be('metric');
      expect(rootNode.params[1].type).to.be('number');
      expect(rootNode.params[2].type).to.be('string');
    });

    it('function with nested function', function() {
      var parser = new Parser("sum(scaleToSeconds(test, 1))");
      var rootNode = parser.getAst();

      expect(rootNode.type).to.be('function');
      expect(rootNode.params.length).to.be(1);
      expect(rootNode.params[0].type).to.be('function');
      expect(rootNode.params[0].name).to.be('scaleToSeconds');
      expect(rootNode.params[0].params.length).to.be(2);
      expect(rootNode.params[0].params[0].type).to.be('metric');
      expect(rootNode.params[0].params[1].type).to.be('number');
    });

    it('function with multiple series', function() {
      var parser = new Parser("sum(test.test.*.count, test.timers.*.count)");
      var rootNode = parser.getAst();

      expect(rootNode.type).to.be('function');
      expect(rootNode.params.length).to.be(2);
      expect(rootNode.params[0].type).to.be('metric');
      expect(rootNode.params[1].type).to.be('metric');
    });

    it('function with templated series', function() {
      var parser = new Parser("sum(test.[[server]].count)");
      var rootNode = parser.getAst();

      expect(rootNode.message).to.be(undefined);
      expect(rootNode.params[0].type).to.be('metric');
      expect(rootNode.params[0].segments[1].type).to.be('segment');
      expect(rootNode.params[0].segments[1].value).to.be('[[server]]');
    });

    it('invalid metric expression', function() {
      var parser = new Parser('metric.test.*.asd.');
      var rootNode = parser.getAst();

      expect(rootNode.message).to.be('Expected metric identifier instead found end of string');
      expect(rootNode.pos).to.be(19);
    });

    it('invalid function expression missing closing paranthesis', function() {
      var parser = new Parser('sum(test');
      var rootNode = parser.getAst();

      expect(rootNode.message).to.be('Expected closing paranthesis instead found end of string');
      expect(rootNode.pos).to.be(9);
    });

    it('unclosed string in function', function() {
      var parser = new Parser("sum('test)");
      var rootNode = parser.getAst();

      expect(rootNode.message).to.be('Unclosed string parameter');
      expect(rootNode.pos).to.be(11);
    });

    it('handle issue #69', function() {
      var parser = new Parser('cactiStyle(offset(scale(net.192-168-1-1.192-168-1-9.ping_value.*,0.001),-100))');
      var rootNode = parser.getAst();
      expect(rootNode.type).to.be('function');
    });

    it('handle float function arguments', function() {
      var parser = new Parser('scale(test, 0.002)');
      var rootNode = parser.getAst();
      expect(rootNode.type).to.be('function');
      expect(rootNode.params[1].type).to.be('number');
      expect(rootNode.params[1].value).to.be(0.002);
    });

    it('handle curly brace pattern at start', function() {
      var parser = new Parser('{apps}.test');
      var rootNode = parser.getAst();
      expect(rootNode.type).to.be('metric');
      expect(rootNode.segments[0].value).to.be('{apps}');
      expect(rootNode.segments[1].value).to.be('test');
    });

    it('series parameters', function() {
      var parser = new Parser('asPercent(#A, #B)');
      var rootNode = parser.getAst();
      expect(rootNode.type).to.be('function');
      expect(rootNode.params[0].type).to.be('series-ref');
      expect(rootNode.params[0].value).to.be('#A');
      expect(rootNode.params[1].value).to.be('#B');
    });

    it('should parse metric expression with ip number segments', function() {
      var parser = new Parser('5.10.123.5');
      var rootNode = parser.getAst();
      expect(rootNode.segments[0].value).to.be('5');
      expect(rootNode.segments[1].value).to.be('10');
      expect(rootNode.segments[2].value).to.be('123');
      expect(rootNode.segments[3].value).to.be('5');
    });

  });

});
