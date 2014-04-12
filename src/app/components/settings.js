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
      timezoneOffset                : 'auto',
    };

    // This initializes a new hash on purpose, to avoid adding parameters to
    // config.js without providing sane defaults
    var settings = {};
    _.each(defaults, function(value, key) {
      settings[key] = typeof options[key] !== 'undefined' ? options[key]  : defaults[key];
    });

    var parseBasicAuth = function(datasource) {
      var passwordEnd = datasource.url.indexOf('@');
      if (passwordEnd > 0) {
        var userStart = datasource.url.indexOf('//') + 2;
        var userAndPassword = datasource.url.substring(userStart, passwordEnd);
        var bytes = crypto.charenc.Binary.stringToBytes(userAndPassword);
        datasource.basicAuth = crypto.util.bytesToBase64(bytes);

        var urlHead = datasource.url.substring(0, userStart);
        datasource.url = urlHead + datasource.url.substring(passwordEnd + 1);
      }

      return datasource;
    };

    if (options.graphiteUrl) {
      settings.datasources = {
        graphite: {
          type: 'graphite',
          url: options.graphiteUrl,
          default: true
        }
      };
    }

    if (settings.timezoneOffset === 'auto' )
    {
      //this hack is to deal with graphites poor tz support. It doesn't like
      // DST, so we're gonna make a january (non-dst) date and get its offset
      var nonDSTDate = new Date(new Date().getFullYear(),0,1);

      //given "Tue Apr 08 2014 08:24:50 GMT-0400 (EDT)", get "-0400"
      settings.timezoneOffset = nonDSTDate.toString().split(' ')[5].substring(3);
    }

    _.each(settings.datasources, function(datasource, key) {
      datasource.name = key;
      parseBasicAuth(datasource);
    });

    var elasticParsed = parseBasicAuth({ url: settings.elasticsearch });
    settings.elasticsearchBasicAuth = elasticParsed.basicAuth;
    settings.elasticsearch = elasticParsed.url;

    return settings;
  };
});
