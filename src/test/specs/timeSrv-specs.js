define([
  'mocks/dashboard-mock',
  './helpers',
  'lodash',
  'services/timeSrv'
], function(dashboardMock, helpers, _) {
  'use strict';

  describe('timeSrv', function() {
    var ctx = new helpers.ServiceTestContext();
    var _dashboard;

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createService('timeSrv'));

    beforeEach(function() {
      _dashboard = dashboardMock.create();
      ctx.service.init(_dashboard);
    });

    describe('timeRange', function() {
      it('should return unparsed when parse is false', function() {
        ctx.service.setTime({from: 'now', to: 'now-1h' });
        var time = ctx.service.timeRange(false);
        expect(time.from).to.be('now');
        expect(time.to).to.be('now-1h');
      });

      it('should return parsed when parse is true', function() {
        ctx.service.setTime({from: 'now', to: 'now-1h' });
        var time = ctx.service.timeRange(true);
        expect(_.isDate(time.from)).to.be(true);
        expect(_.isDate(time.to)).to.be(true);
      });
    });

    describe('setTime', function() {
      it('should return disable refresh for absolute times', function() {
        _dashboard.refresh = false;

        ctx.service.setTime({from: '2011-01-01', to: '2015-01-01' });
        expect(_dashboard.refresh).to.be(false);
      });

      it('should restore refresh after relative time range is set', function() {
        _dashboard.refresh = '10s';
        ctx.service.setTime({from: '2011-01-01', to: '2015-01-01' });
        expect(_dashboard.refresh).to.be(false);
        ctx.service.setTime({from: '2011-01-01', to: 'now' });
        expect(_dashboard.refresh).to.be('10s');
      });
    });

  });

});
