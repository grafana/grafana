/** @scratch /configuration/config.js/1
 * == Configuration
 * config.js is where you will find the core Grafana configuration. This file contains parameter that
 * must be set before kibana is run for the first time.
 */
define(['settings'],
function (Settings) {
  "use strict";

  return new Settings({

    elasticsearch: "http://"+window.location.hostname+":9200",

    graphiteUrl: "http://"+window.location.hostname+":8080",

    default_route: '/dashboard/file/default.json',

    grafana_index: "grafana-dash",

    panel_names: [
      'text',
      'graphite'
    ]
  });
});
