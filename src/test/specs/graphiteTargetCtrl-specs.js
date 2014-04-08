define([
], function() {
  'use strict';

  describe('graphiteTargetCtrl', function() {
    var _targetCtrl;

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
      });
    });
  });
});
