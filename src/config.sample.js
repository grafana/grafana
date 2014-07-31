///// @scratch /configuration/config.js/1
 // == Configuration
 // config.js is where you will find the core Grafana configuration. This file contains parameter that
 // must be set before Grafana is run for the first time.
 ///
define(['settings'],
function (Settings) {
  "use strict";

  return new Settings({

    // datasources
    // Delete the ones you do not want, you can add multiple of the same type
    // grafanaDB: true marks the datasource for use as dashboard storage (only supported by elasticsearch and influxdb datasources)
    datasources: {
      graphite: {
        type: 'graphite',
        url: "http://my.graphite.server.com:8080",
        default: true
      },
      influxdb: {
        type: 'influxdb',
        url: "http://my_influxdb_server:8086/db/database_name",
        username: 'admin',
        password: 'admin'
      },
      // elasticsearch, used for storing and loading dashboards, annotations
      // For Basic authentication use: http://username:password@domain.com:9200
      elasticsearch: {
        type: 'elasticsearch',
        url: "http://"+window.location.hostname+":9200",
        index: 'grafana-dash',  // index for storing dashboards
        grafanaDB: true,
      }
    },

    search: {
      max_results: 20
    },

    // default start dashboard
    default_route: '/dashboard/file/default.json',

    // set to false to disable unsaved changes warning
    unsaved_changes_warning: true,

    // set the default timespan for the playlist feature
    // Example: "1m", "1h"
    playlist_timespan: "1m",

    // If you want to specify password before saving, please specify it bellow
    // The purpose of this password is not security, but to stop some users from accidentally changing dashboards
    admin: {
      password: ''
    },

    // Add your own custom pannels
    plugins: {
      panels: []
    }

  });
});
