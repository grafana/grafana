define([
  'mocks/dashboard-mock',
  './helpers',
  'services/templateValuesSrv'
], function(dashboardMock, helpers) {
  'use strict';

  describe('templateValuesSrv', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['datasourceSrv', 'timeSrv', 'templateSrv']));
    beforeEach(ctx.createService('templateValuesSrv'));

    describe('update time period variable options', function() {
      var variable = { type: 'interval', query: 'auto,1s,2h,5h,1d', name: 'test' };

      beforeEach(function() {
        ctx.service.updateOptions(variable);
      });

      it('should update options array', function() {
        expect(variable.options.length).to.be(5);
        expect(variable.options[1].text).to.be('1s');
        expect(variable.options[1].value).to.be('1s');
      });
    });

    function describeUpdateVariable(desc, fn) {
      describe(desc, function() {
        var scenario = {};
        scenario.setup = function(setupFn) {
         scenario.setupFn = setupFn;
        };

        beforeEach(function() {
          scenario.setupFn();
          var ds = {};
          ds.metricFindQuery = sinon.stub().returns(ctx.$q.when(scenario.queryResult));
          ctx.datasourceSrv.get = sinon.stub().returns(ds);

          ctx.service.updateOptions(scenario.variable);
          ctx.$rootScope.$digest();
        });

        fn(scenario);
      });
    }

    describeUpdateVariable('time period variable ', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'interval', query: 'auto,1s,2h,5h,1d', name: 'test' };
      });

      it('should update options array', function() {
        expect(scenario.variable.options.length).to.be(5);
        expect(scenario.variable.options[1].text).to.be('1s');
        expect(scenario.variable.options[1].value).to.be('1s');
      });
    });

    describeUpdateVariable('basic query variable', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should update options array', function() {
        expect(scenario.variable.options.length).to.be(2);
        expect(scenario.variable.options[0].text).to.be('backend1');
        expect(scenario.variable.options[0].value).to.be('backend1');
        expect(scenario.variable.options[1].value).to.be('backend2');
      });

      it('should select first option as value', function() {
        expect(scenario.variable.current.value).to.be('backend1');
      });
    });

    describeUpdateVariable('and existing value still exists in options', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.current = { value: 'backend2'};
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should keep variable value', function() {
        expect(scenario.variable.current.value).to.be('backend2');
      });
    });

    describeUpdateVariable('and regex pattern exists', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.regex = '/apps.*(backend_[0-9]+)/';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should extract and use match group', function() {
        expect(scenario.variable.options[0].value).to.be('backend_01');
      });
    });

    describeUpdateVariable('and regex pattern exists and no match', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.regex = '/apps.*(backendasd[0-9]+)/';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should not add non matching items', function() {
        expect(scenario.variable.options.length).to.be(0);
      });
    });

   describeUpdateVariable('regex pattern without slashes', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.regex = 'backend_01';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should return matches options', function() {
        expect(scenario.variable.options.length).to.be(1);
      });
    });

   describeUpdateVariable('regex pattern remove duplicates', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.regex = 'backend_01';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_01.counters.req'}];
      });

      it('should return matches options', function() {
        expect(scenario.variable.options.length).to.be(1);
      });
    });

    describeUpdateVariable('and existing value still exists in options', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.current = { value: 'backend2'};
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should keep variable value', function() {
        expect(scenario.variable.current.value).to.be('backend2');
      });
    });

    describeUpdateVariable('with include All glob syntax', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'glob' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All Glob option', function() {
        expect(scenario.variable.options[0].value).to.be('{backend1,backend2,backend3}');
      });
    });

    describeUpdateVariable('with include all wildcard', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'wildcard' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(scenario.variable.options[0].value).to.be('*');
      });
    });

    describeUpdateVariable('with include all wildcard', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'regex wildcard' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(scenario.variable.options[0].value).to.be('.*');
      });
    });

    describeUpdateVariable('with include all regex values', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'wildcard' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(scenario.variable.options[0].value).to.be('*');
      });
    });

    describeUpdateVariable('with include all glob no values', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'glob' };
        scenario.queryResult = [];
      });

      it('should add empty glob', function() {
        expect(scenario.variable.options[0].value).to.be('{}');
      });
    });

  });

});
