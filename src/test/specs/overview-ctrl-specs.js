define([
    'panels/overview/module'
], function() {
  'use strict';

  describe('OverviewCtrl', function() {
    var _controller;
    var _scope;

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.overview'));

    beforeEach(module(function($provide){
      $provide.value('datasourceSrv',{
        getMetricSources: function() {
        },
        get: function() {
          return {};
        }
      });
    }));

    beforeEach(inject(function($controller, $rootScope) {
      _scope = $rootScope.$new();
      _scope.panel = { targets: [] };
      _controller = $controller('OverviewCtrl', {
        $scope: _scope
      });
    }));

    describe('init', function() {
      beforeEach(function() {
      });

      it('description', function() {

      });
    });
  });
});
