define([
  'mocks/dashboard-mock',
  'underscore',
  'services/filterSrv'
], function(dashboardMock, _) {

  describe('filterSrv', function() {
    var _filterSrv;

    beforeEach(module('kibana.services'));
    beforeEach(module(function($provide){
      $provide.value('dashboard', dashboardMock.create());
    }));

    beforeEach(inject(function(filterSrv) {
      _filterSrv = filterSrv;
    }));

    describe('init', function() {
      beforeEach(function() {
        _filterSrv.add({ name: 'test', current: { value: 'oogle' } });
        _filterSrv.init();
      });

      it('should initialize template data', function() {
        var target = _filterSrv.applyFilterToTarget('this.[[test]].filters');
        expect(target).to.be('this.oogle.filters');
      });
    });

    describe.only('filterOptionSelected', function() {
      beforeEach(function() {
        _filterSrv.add({ name: 'test' });
        _filterSrv.filterOptionSelected(_filterSrv.list[0], { value: 'muuuu' });
      });
      it('should set current value and update template data', function() {
        var target = _filterSrv.applyFilterToTarget('this.[[test]].filters');
        expect(target).to.be('this.muuuu.filters');
      });
    });

    describe('timeRange', function() {
      it('should return unparsed when parse is false', function() {
        _filterSrv.setTime({from: 'now', to: 'now-1h' });
        var time = _filterSrv.timeRange(false);
        expect(time.from).to.be('now');
        expect(time.to).to.be('now-1h');
      });

      it('should return parsed when parse is true', function() {
        _filterSrv.setTime({from: 'now', to: 'now-1h' });
        var time = _filterSrv.timeRange(true);
        expect(_.isDate(time.from)).to.be(true);
        expect(_.isDate(time.to)).to.be(true);
      });
    });

  });

});
