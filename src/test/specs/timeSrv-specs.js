define([
  'mocks/dashboard-mock',
  'lodash',
  'services/timeSrv'
], function(dashboardMock, _) {
  'use strict';

  describe('timeSrv', function() {
    var _timeSrv;
    var _dashboard;

    beforeEach(module('grafana.services'));
    beforeEach(inject(function(timeSrv) {
      _timeSrv = timeSrv;
      _dashboard = dashboardMock.create();
    }));

    beforeEach(function() {
      _timeSrv.init(_dashboard);
    });

    describe('timeRange', function() {
      it('should return unparsed when parse is false', function() {
        _timeSrv.setTime({from: 'now', to: 'now-1h' });
        var time = _timeSrv.timeRange(false);
        expect(time.from).to.be('now');
        expect(time.to).to.be('now-1h');
      });

      it('should return parsed when parse is true', function() {
        _timeSrv.setTime({from: 'now', to: 'now-1h' });
        var time = _timeSrv.timeRange(true);
        expect(_.isDate(time.from)).to.be(true);
        expect(_.isDate(time.to)).to.be(true);
      });
    });

    describe('setTime', function() {
      it('should return disable refresh for absolute times', function() {
        _dashboard.refresh = false;

        _timeSrv.setTime({from: '2011-01-01', to: '2015-01-01' });
        expect(_dashboard.refresh).to.be(false);
      });

      it('should restore refresh after relative time range is set', function() {
        _dashboard.refresh = '10s';
        _timeSrv.setTime({from: '2011-01-01', to: '2015-01-01' });
        expect(_dashboard.refresh).to.be(false);
        _timeSrv.setTime({from: '2011-01-01', to: 'now' });
        expect(_dashboard.refresh).to.be('10s');
      });
    });

  });

});
