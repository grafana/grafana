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

    elasticsearch_all_disabled: false,
    /**
     * For Basic authentication use: http://username:password@domain.com
     * Basic authentication requires special nginx or apache2 headers for cross origin comain to work
     * Check install documentation on github
     */
    graphiteUrl: "http://"+window.location.hostname+":8080",

    default_route: '/dashboard/file/default.json',

    /**
     * If your graphite server has another timezone than you & users browsers specify the offset here
     * Example: "-0500" (for UTC - 5 hours)
     */
    timezoneOffset: null,

    grafana_index: "grafana-dash",

    panel_names: [
      'text',
      'graphite'
    ]
  });
});
