define([
  'mocks/dashboard-mock',
  'underscore',
  'services/filterSrv'
], function(dashboardMock, _) {

  describe('graphiteTargetCtrl', function() {
    var _filterSrv;

    beforeEach(module('kibana.services'));
    beforeEach(module(function($provide){
      $provide.value('filterSrv',{});
    }));

    beforeEach(inject(function($controller, $rootScope) {
      _targetCtrl = $controller({
        $scope: $rootScope.$new()
      });
    }));

    describe('init', function() {
      beforeEach(function() {
        _filterSrv.add({ name: 'test', current: { value: 'oogle' } });
        _filterSrv.init();
      });
    });
  });
});
