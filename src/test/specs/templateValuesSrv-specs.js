define([
  'mocks/dashboard-mock',
  'lodash',
  'services/templateValuesSrv'
], function(dashboardMock) {
  'use strict';

  describe('templateValuesSrv', function() {
    var _templateValuesSrv;
    var _dashboard;

    beforeEach(module('grafana.services'));
    beforeEach(module(function($provide) {
      $provide.value('datasourceSrv', {});
      $provide.value('templateSrv', {
        updateTemplateData: function() {}
      });
      _dashboard = dashboardMock.create();
    }));

    beforeEach(inject(function(templateValuesSrv) {
      _templateValuesSrv = templateValuesSrv;
    }));

    describe('update time period variable options', function() {
      var variable = {
        type: 'time period',
        query: 'auto,1s,2h,5h,1d',
        name: 'test'
      };

      beforeEach(function() {
        _templateValuesSrv.updateOptions(variable);
      });

      it('should update options array', function() {
        expect(variable.options.length).to.be(5);
        expect(variable.options[1].text).to.be('1s');
        expect(variable.options[1].value).to.be('1s');
      });
    });

  });

});
