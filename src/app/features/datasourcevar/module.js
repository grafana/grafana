define([
  'angular',
],
function (angular) {
  'use strict';

  angular
    .module('grafana.services')
    .service('datasourceVarSrv', function(datasourceSrv, VariableDatasource) {

      this.init = function(datasourceName) {
        datasourceSrv.add(new VariableDatasource(datasourceName));
      };
      this.remove = function(datasourceName) {
        datasourceSrv.remove('$'+datasourceName);
      };

    })
    .factory('VariableDatasource', function(datasourceSrv, $rootScope) {

      function VariableDatasource(datasourceName) {
        this.name = '$'+datasourceName;
        this.value =  '$'+datasourceName;
        var self = this;

        Object.setPrototypeOf(self,datasourceSrv.get(datasourceName));

        $rootScope.onAppEvent('ds-changed', function(e, info) {
          var ds=info.datasource;
          //console.log('ds-changed');
          Object.setPrototypeOf(self,datasourceSrv.get(ds));
          $rootScope.$broadcast('refresh');
        });
      }

      return VariableDatasource;

    });
});
