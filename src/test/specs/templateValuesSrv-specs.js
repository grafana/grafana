define([
  'mocks/dashboard-mock',
  'lodash',
  'services/templateValuesSrv'
], function(dashboardMock) {
  'use strict';

  describe('templateValuesSrv', function() {
    var _templateValuesSrv;
    var _dashboard;
    var _datasourceSrv = {};
    var _q;
    var _rootScope;

    beforeEach(module('grafana.services'));
    beforeEach(module(function($provide) {
      $provide.value('datasourceSrv', _datasourceSrv);
      $provide.value('templateSrv', {
        updateTemplateData: function() {}
      });
      _dashboard = dashboardMock.create();
    }));

    beforeEach(inject(function(templateValuesSrv, $rootScope, $q) {
      _templateValuesSrv = templateValuesSrv;
      _rootScope = $rootScope;
      _q = $q;
    }));

    describe('update time period variable options', function() {
      var variable = { type: 'time period', query: 'auto,1s,2h,5h,1d', name: 'test' };

      beforeEach(function() {
        _templateValuesSrv.updateOptions(variable);
      });

      it('should update options array', function() {
        expect(variable.options.length).to.be(5);
        expect(variable.options[1].text).to.be('1s');
        expect(variable.options[1].value).to.be('1s');
      });
    });

    function describeUpdateVariable(desc, fn) {
      describe(desc, function() {
        var ctx = {};
        ctx.setup = function(setupFn) {
         ctx.setupFn = setupFn;
        };

        beforeEach(function() {
          ctx.setupFn();
          var ds = {};
          ds.metricFindQuery = sinon.stub().returns(_q.when(ctx.queryResult));
          _datasourceSrv.get = sinon.stub().returns(ds);

          _templateValuesSrv.updateOptions(ctx.variable);
          _rootScope.$digest();
        });

        fn(ctx);
      });
    }

    describeUpdateVariable('time period variable ', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'time period', query: 'auto,1s,2h,5h,1d', name: 'test' };
      });

      it('should update options array', function() {
        expect(ctx.variable.options.length).to.be(5);
        expect(ctx.variable.options[1].text).to.be('1s');
        expect(ctx.variable.options[1].value).to.be('1s');
      });
    });

    describeUpdateVariable('basic query variable', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test' };
        ctx.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should update options array', function() {
        expect(ctx.variable.options.length).to.be(2);
        expect(ctx.variable.options[0].text).to.be('backend1');
        expect(ctx.variable.options[0].value).to.be('backend1');
        expect(ctx.variable.options[1].value).to.be('backend2');
      });

      it('should select first option as value', function() {
        expect(ctx.variable.current.value).to.be('backend1');
      });
    });

    describeUpdateVariable('and existing value still exists in options', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test' };
        ctx.variable.current = { value: 'backend2'};
        ctx.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should keep variable value', function() {
        expect(ctx.variable.current.value).to.be('backend2');
      });
    });

    describeUpdateVariable('and regex pattern exists', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test' };
        ctx.variable.regex = '/apps.*(backend_[0-9]+)/';
        ctx.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should extract and use match group', function() {
        expect(ctx.variable.options[0].value).to.be('backend_01');
      });
    });

    describeUpdateVariable('and regex pattern exists and no match', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test' };
        ctx.variable.regex = '/apps.*(backendasd[0-9]+)/';
        ctx.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should not add non matching items', function() {
        expect(ctx.variable.options.length).to.be(0);
      });
    });

   describeUpdateVariable('regex pattern without slashes', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test' };
        ctx.variable.regex = 'backend_01';
        ctx.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should return matches options', function() {
        expect(ctx.variable.options.length).to.be(1);
      });
    });

   describeUpdateVariable('regex pattern remove duplicates', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test' };
        ctx.variable.regex = 'backend_01';
        ctx.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_01.counters.req'}];
      });

      it('should return matches options', function() {
        expect(ctx.variable.options.length).to.be(1);
      });
    });

    describeUpdateVariable('and existing value still exists in options', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test' };
        ctx.variable.current = { value: 'backend2'};
        ctx.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should keep variable value', function() {
        expect(ctx.variable.current.value).to.be('backend2');
      });
    });

    describeUpdateVariable('with include All glob syntax', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'glob' };
        ctx.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All Glob option', function() {
        expect(ctx.variable.options[0].value).to.be('{backend1,backend2,backend3}');
      });
    });

    describeUpdateVariable('with include all wildcard', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'wildcard' };
        ctx.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(ctx.variable.options[0].value).to.be('*');
      });
    });

    describeUpdateVariable('with include all wildcard', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'regex wildcard' };
        ctx.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(ctx.variable.options[0].value).to.be('.*');
      });
    });

    describeUpdateVariable('with include all regex values', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'wildcard' };
        ctx.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(ctx.variable.options[0].value).to.be('*');
      });
    });

    describeUpdateVariable('with include all glob no values', function(ctx) {
      ctx.setup(function() {
        ctx.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'glob' };
        ctx.queryResult = [];
      });

      it('should add empty glob', function() {
        expect(ctx.variable.options[0].value).to.be('{}');
      });
    });

  });

});
