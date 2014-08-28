define([
  'mocks/dashboard-mock',
  'lodash',
  'services/templateSrv'
], function(dashboardMock) {
  'use strict';

  describe('templateSrv', function() {
    var _templateSrv;
    var _dashboard;

    beforeEach(module('grafana.services'));
    beforeEach(module(function() {
      _dashboard = dashboardMock.create();
    }));

    beforeEach(inject(function(templateSrv) {
      _templateSrv = templateSrv;
    }));

    describe('init', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: 'oogle' } }]);
      });

      it('should initialize template data', function() {
        var target = _templateSrv.replace('this.[[test]].filters');
        expect(target).to.be('this.oogle.filters');
      });
    });

    describe('updateTemplateData with simple value', function() {
      beforeEach(function() {
        _templateSrv.init([{ name: 'test', current: { value: 'muuuu' } }]);
        _templateSrv.updateTemplateData();
      });

      it('should set current value and update template data', function() {
        var target = _templateSrv.replace('this.[[test]].filters');
        expect(target).to.be('this.muuuu.filters');
      });
    });

  });

});
