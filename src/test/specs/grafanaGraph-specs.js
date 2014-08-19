define([
  './helpers',
  'angular',
  'jquery',
  'directives/grafanaGraph'
], function(helpers, angular, $) {
  'use strict';

  describe('grafanaGraph', function() {

    beforeEach(module('grafana.directives'));

    function graphScenario(desc, func)  {
      describe(desc, function() {
        var ctx = {};
        ctx.setup = function (setupFunc) {
          beforeEach(inject(function($rootScope, $compile) {
            var scope = $rootScope.$new();
            var element = angular.element("<div style='width:500px' grafana-graph><div>");

            scope.height = '200px';
            scope.panel = {
              legend: {},
              grid: {},
              y_formats: []
            };
            scope.dashboard = { timezone: 'browser' };
            scope.range = {
              from: new Date('2014-08-09 10:00:00'),
              to: new Date('2014-09-09 13:00:00')
            };

            setupFunc(scope);

            $compile(element)(scope);
            scope.$digest();
            $.plot = ctx.plotSpy = sinon.spy();

            scope.$emit('render', []);
            ctx.plotData = ctx.plotSpy.getCall(0).args[1];
            ctx.plotOptions = ctx.plotSpy.getCall(0).args[2];
          }));
        };

        func(ctx);
      });
    }

    graphScenario('simple lines options', function(ctx) {
      ctx.setup(function(scope) {
        scope.panel.lines = true;
        scope.panel.fill = 5;
        scope.panel.linewidth = 3;
        scope.panel.steppedLine = true;
      });

      it('should configure plot with correct options', function() {
        expect(ctx.plotOptions.series.lines.show).to.be(true);
        expect(ctx.plotOptions.series.lines.fill).to.be(0.5);
        expect(ctx.plotOptions.series.lines.lineWidth).to.be(3);
        expect(ctx.plotOptions.series.lines.steps).to.be(true);
      });

    });

  });
});

