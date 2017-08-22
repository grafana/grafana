System.register([], function (_export) {
  "use strict";

  return {
    setters: [],
    execute: function () {

      function Datasource(instanceSettings, backendSrv) {
        this.url = instanceSettings.url;

        this.testDatasource = function() {
          return backendSrv.datasourceRequest({
            method: 'GET',
            url: this.url  + '/api/v4/search'
          });
        }
      }

      function ConfigCtrl() {

      }

      ConfigCtrl.template = `
        <div class="gf-form">
          <label class="gf-form-label width-13">Email </label>
          <input type="text" class="gf-form-input max-width-18" ng-model='ctrl.current.jsonData.email'></input>
         </div>
         <div class="gf-form">
          <label class="gf-form-label width-13">Access key ID </label>
          <input type="text" class="gf-form-input max-width-18" ng-model='ctrl.current.secureJsonData.token'></input>
         </div>
      `;

      _export('Datasource', Datasource);
      _export('ConfigCtrl', ConfigCtrl);
    }
  };
});
