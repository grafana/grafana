define([
  './helpers',
  'controllers/sharePanelCtrl'
], function(helpers) {
  'use strict';

  describe('SharePanelCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.controllers'));

    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('SharePanelCtrl'));

    describe('shareUrl with current time range and panel', function() {

      it('should generate share url relative time', function() {
        ctx.$location.path('/test');
        ctx.scope.panel = { id: 22 };
        ctx.timeSrv.time = { from: 'now-1h', to: 'now' };

        ctx.scope.buildUrl();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=now-1h&to=now&panelId=22&fullscreen');
      });

      it('should generate share url absolute time', function() {
        ctx.$location.path('/test');
        ctx.scope.panel = { id: 22 };
        ctx.timeSrv.time = { from: new Date(1362178800000), to: new Date(1396648800000) };

        ctx.scope.buildUrl();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=1362178800000&to=1396648800000&panelId=22&fullscreen');
      });

      it('should generate share url with time as JSON strings', function() {
        ctx.$location.path('/test');
        ctx.scope.panel = { id: 22 };
        ctx.timeSrv.time = { from: "2012-01-31T23:00:00.000Z", to: "2014-04-04T22:00:00.000Z" };

        ctx.scope.buildUrl();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=1328050800000&to=1396648800000&panelId=22&fullscreen');
      });

      it('should remove panel id when toPanel is false', function() {
        ctx.$location.path('/test');
        ctx.scope.panel = { id: 22 };
        ctx.scope.toPanel = false;
        ctx.timeSrv.time = { from: 'now-1h', to: 'now' };

        ctx.scope.buildUrl();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=now-1h&to=now');
      });

      it('should include template variables in url', function() {
        ctx.$location.path('/test');
        ctx.scope.panel = { id: 22 };
        ctx.scope.includeTemplateVars = true;
        ctx.scope.toPanel = false;
        ctx.templateSrv.variables = [{ name: 'app', current: {text: 'mupp' }}, {name: 'server', current: {text: 'srv-01'}}];
        ctx.timeSrv.time = { from: 'now-1h', to: 'now' };

        ctx.scope.buildUrl();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=now-1h&to=now&var-app=mupp&var-server=srv-01');
      });

    });

  });

});

