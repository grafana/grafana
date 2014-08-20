define([
  './helpers',
  'angular',
  'jquery',
  'components/timeSeries',
  'directives/grafanaGraph'
], function(helpers, angular, $, TimeSeries) {
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
              y_formats: [],
              seriesOverrides: []
            };
            scope.dashboard = { timezone: 'browser' };
            scope.range = {
              from: new Date('2014-08-09 10:00:00'),
              to: new Date('2014-09-09 13:00:00')
            };
            ctx.data = [];
            ctx.data.push(new TimeSeries({
              datapoints: [[1,1],[2,2]],
              info: { alias: 'series1', enable: true }
            }));
            ctx.data.push(new TimeSeries({
              datapoints: [[1,1],[2,2]],
              info: { alias: 'series2', enable: true }
            }));

            setupFunc(scope, ctx.data);

            $compile(element)(scope);
            scope.$digest();
            $.plot = ctx.plotSpy = sinon.spy();

            scope.$emit('render', ctx.data);
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

    graphScenario('series option overrides, fill & points', function(ctx) {
      ctx.setup(function(scope, data) {
        scope.panel.lines = true;
        scope.panel.fill = 5;
        scope.panel.seriesOverrides = [
          { alias: 'test', fill: 0, points: true }
        ];

        data[1].info.alias = 'test';
      });

      it('should match second series and fill zero, and enable points', function() {
        expect(ctx.plotOptions.series.lines.fill).to.be(0.5);
        expect(ctx.plotData[1].lines.fill).to.be(0.001);
        expect(ctx.plotData[1].points.show).to.be(true);
      });
    });

    graphScenario('series option overrides, bars, true & lines false', function(ctx) {
      ctx.setup(function(scope, data) {
        scope.panel.lines = true;
        scope.panel.seriesOverrides = [
          { alias: 'test', bars: true, lines: false }
        ];

        data[1].info.alias = 'test';
      });

      it('should match second series and disable lines, and enable bars', function() {
        expect(ctx.plotOptions.series.lines.show).to.be(true);
        expect(ctx.plotData[1].lines.show).to.be(false);
        expect(ctx.plotData[1].bars.show).to.be(true);
      });
    });

    graphScenario('series option overrides, linewidth, stack', function(ctx) {
      ctx.setup(function(scope, data) {
        scope.panel.lines = true;
        scope.panel.stack = true;
        scope.panel.linewidth = 2;
        scope.panel.seriesOverrides = [
          { alias: 'test', linewidth: 5, stack: false }
        ];

        data[1].info.alias = 'test';
      });

      it('should match second series and disable stack, and set lineWidth', function() {
        expect(ctx.plotOptions.series.stack).to.be(true);
        expect(ctx.plotData[1].stack).to.be(false);
        expect(ctx.plotData[1].lines.lineWidth).to.be(5);
      });
    });

    graphScenario('series option overrides, pointradius, steppedLine', function(ctx) {
      ctx.setup(function(scope, data) {
        scope.panel.seriesOverrides = [
          { alias: 'test', pointradius: 5, steppedLine: true }
        ];

        data[1].info.alias = 'test';
      });

      it('should match second series and set pointradius, and set steppedLine', function() {
        expect(ctx.plotData[1].points.radius).to.be(5);
        expect(ctx.plotData[1].lines.steps).to.be(true);
      });
    });

    graphScenario('override match on regex', function(ctx) {
      ctx.setup(function(scope, data) {
        scope.panel.lines = true;
        scope.panel.seriesOverrides = [
          { alias: '/.*01/', lines: false }
        ];

        data[1].info.alias = 'test_01';
      });

      it('should match second series', function() {
        expect(ctx.plotData[0].lines.show).to.be(undefined);
        expect(ctx.plotData[1].lines.show).to.be(false);
      });
    });

    graphScenario('override series y-axis', function(ctx) {
      ctx.setup(function(scope, data) {
        scope.panel.lines = true;
        scope.panel.seriesOverrides = [
          { alias: 'test', yaxis: 2 }
        ];

        data[1].info.alias = 'test';
      });

      it('should match second series and set yaxis', function() {
        expect(ctx.plotData[1].yaxis).to.be(2);
      });
    });

  });
});

