define([
  'underscore',
  'crypto',
],
function (_, crypto) {
  "use strict";

  return function Settings (options) {
    /**
     * To add a setting, you MUST define a default. Also,
     * THESE ARE ONLY DEFAULTS.
     * They are overridden by config.js in the root directory
     * @type {Object}
     */
    var defaults = {
      elasticsearch                 : "http://"+window.location.hostname+":9200",
      datasources                   : {
        default: {
          url: "http://"+window.location.hostname+":8080",
          default: true
        }
      },
      panel_names                   : [],
      default_route                 : '/dashboard/file/default.json',
      grafana_index                 : 'grafana-dash',
      elasticsearch_all_disabled    : false,
      timezoneOffset                : null,
    };

    // This initializes a new hash on purpose, to avoid adding parameters to
    // config.js without providing sane defaults
    var settings = {};
    _.each(defaults, function(value, key) {
      settings[key] = typeof options[key] !== 'undefined' ? options[key]  : defaults[key];
    });

    var basicAuth = function(url) {
      var passwordAt = url.indexOf('@');
      if (passwordAt > 0) {
        var userStart = url.indexOf('//') + 2;
        var userAndPassword = url.substring(userStart, passwordAt);
        var bytes = crypto.charenc.Binary.stringToBytes(userAndPassword);
        var base64 = crypto.util.bytesToBase64(bytes);
        return base64;
      }
    };

    if (options.graphiteUrl) {
      settings.datasources = {
        graphite: {
          name: 'default',
          url: options.graphiteUrl,
          default: true,
          basicAuth: basicAuth(options.graphiteUrl)
        }
      };
    }
    else {
      _.each(_.values(settings.datasources), function(source) {
        source.basicAuth = basicAuth(source.url);
      });
    }

    settings.elasticsearchBasicAuth = basicAuth(settings.elasticsearch);
    return settings;
  };
});
