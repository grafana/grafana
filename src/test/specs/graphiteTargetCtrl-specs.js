define([
  'mocks/dashboard-mock',
  'underscore',
  'services/filterSrv'
], function(dashboardMock, _) {

  describe('graphiteTargetCtrl', function() {
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
    });
});
