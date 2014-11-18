/* global _ */

/*
 * Complex scripted dashboard
 * This script generates a dashboard object that Grafana can load. It also takes a number of user
 * supplied URL parameters (int ARGS variable)
 *
 * Global accessable variables
 * window, document, $, jQuery, ARGS, moment
 *
 * Return a dashboard object, or a function
 *
 * For async scripts, return a function, this function must take a single callback function,
 * call this function with the dasboard object
 */

'use strict';

// accessable variables in this scope
var window, document, ARGS, $, jQuery, moment, kbn;

return function(callback) {

  // Setup some variables
  var dashboard, timspan;

  // Set a default timespan if one isn't specified
  timspan = ARGS.from || 'now-1d';

  // Intialize a skeleton with nothing but a rows array and service object
  dashboard = {
    rows : [],
    services : {}
  };

  // Set a title
  dashboard.title = 'Scripted dash';
  dashboard.time = {
    from: timspan,
    to: "now"
  };

  var rows = 1;
  var seriesName = 'argName';

  if(!_.isUndefined(ARGS.rows)) {
    rows = parseInt(ARGS.rows, 10);
  }

  if(!_.isUndefined(ARGS.name)) {
    seriesName = ARGS.name;
  }

  $.ajax({
    method: 'GET',
    url: '/'
  })
  .done(function(result) {

    dashboard.rows.push({
      title: 'Chart',
      height: '300px',
      panels: [
        {
          title: 'Async dashboard test',
          type: 'text',
          span: 12,
          fill: 1,
          content: '# Async test'
        }
      ]
    });

    // when dashboard is composed call the callback
    // function and pass the dashboard
    callback(dashboard);

  });
}
