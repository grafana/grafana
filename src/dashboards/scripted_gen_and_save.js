/* global _ */

/*
 * Complex scripted dashboard
 * This script generates a dashboard object that Grafana can load. It also takes a number of user
 * supplied URL parameters (int ARGS variable)
 *
 * Return a dashboard object, or a function
 *
 * For async scripts, return a function, this function must take a single callback function as argument,
 * call this callback function with the dashboard object (look at scripted_async.js for an example)
 */

'use strict';

// accessable variables in this scope
var window, document, ARGS, $, jQuery, moment, kbn, services, _;

// default datasource
var datasource = services.datasourceSrv.default;
// get datasource used for saving dashboards
var dashboardDB = services.datasourceSrv.getGrafanaDB();

var targets = [];

function getTargets(path) {
  return datasource.metricFindQuery(path + '.*').then(function(result) {
    if (!result) {
      return null;
    }

    if (targets.length === 10) {
      return null;
    }

    var promises = _.map(result, function(metric) {
      if (metric.expandable) {
        return getTargets(path + "." + metric.text);
      }
      else {
        targets.push(path + '.' + metric.text);
      }
      return null;
    });

    return services.$q.all(promises);
  });
}

function createDashboard(target, index) {
  // Intialize a skeleton with nothing but a rows array and service object
  var dashboard = { rows : [] };
  dashboard.title = 'Scripted dash ' + index;
  dashboard.time = {
    from: "now-6h",
    to: "now"
  };

  dashboard.rows.push({
    title: 'Chart',
    height: '300px',
    panels: [
    {
      title: 'Events',
      type: 'graph',
      span: 12,
      targets: [ {target: target} ]
    }
  ]
  });

  return dashboard;
}

function saveDashboard(dashboard) {
  var model = services.dashboardSrv.create(dashboard);
  dashboardDB.saveDashboard(model);
}

return function(callback)  {

  getTargets('apps').then(function() {
    console.log('targets: ', targets);
    _.each(targets, function(target, index) {
      var dashboard = createDashboard(target, index);
      saveDashboard(dashboard);

      if (index === targets.length - 1) {
        callback(dashboard);
      }
    });
  });

};

