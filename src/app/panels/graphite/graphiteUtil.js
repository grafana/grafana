define([
  'jquery'
],
function ($) {
  'use strict';

  String.prototype.graphiteGlob = function(glob) {
    var regex = '^';
    for (var i = 0; i < glob.length; i++ ) {
      var c = glob.charAt(i);
      switch (c) {
        case '*':
          regex += '[^\.]+';
          break;
        case '.':
          regex += '\\.';
          break;
        default:
          regex += c;
      }
    }
    regex += '$';
    return this.match(regex);
  }

  function build_graphite_options(options, raw) {
    raw = raw || false;
    var clean_options = [];
    //var internal_options = ['_t'];
    var graphite_options = ['target', 'targets', 'from', 'until', 'rawData', 'format'];
    var graphite_png_options = ['areaMode', 'width', 'height', 'template', 'margin', 'bgcolor',
                         'fgcolor', 'fontName', 'fontSize', 'fontBold', 'fontItalic',
                         'yMin', 'yMax', 'colorList', 'title', 'vtitle', 'lineMode',
                         'lineWith', 'hideLegend', 'hideAxes', 'hideGrid', 'minXstep',
                         'majorGridlineColor', 'minorGridLineColor', 'minorY',
                         'thickness', 'min', 'max', 'tz'];

    if(raw) {
      options['format'] = 'json';
    } else {
      // use random parameter to force image refresh
      options["_t"] = options["_t"] || Math.random();
    }

    $.each(options, function (key, value) {
      if(raw) {
        if ($.inArray(key, graphite_options) === -1) {
          return;
        }
      } else {
        if ($.inArray(key, graphite_options) === -1 && $.inArray(key, graphite_png_options) === -1) {
          return;
        }
      }
      if (key === "targets") {
        $.each(value, function (index, value) {
          if (raw) {
            // it's normally pointless to use alias() in raw mode, because we apply an alias (name) ourself
            // in the client rendering step.  we just need graphite to return the target.
            // but graphite sometimes alters the name of the target in the returned data
            // (https://github.com/graphite-project/graphite-web/issues/248)
            // so we need a good string identifier and set it using alias() (which graphite will honor)
            // so that we recognize the returned output. simplest is just to include the target spec again
            // though this duplicates a lot of info in the url.
            clean_options.push("target=" + encodeURIComponent(value.target));
          } else {
            clean_options.push("target=alias(color(" +encodeURIComponent(value.target + ",'" + value.color) +"'),'" + value.name +"')");
          }
        });
      } else if (value !== null) {
        clean_options.push(key + "=" + encodeURIComponent(value));
      }
    });

    return clean_options;
  }

  function build_graphite_url(options) {
    var limit = 2000;  // http://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
    var url = options.graphite_url + "?";

    options = build_graphite_options(options, false);
    $.map(options, function(option) {
        if (url.length + option.length < limit) {
            url += '&' + option;
        }
    });
    return url.replace(/\?&/, "?");
  }

  function find_definition (target_graphite, options) {
    var matching_i = undefined;

    for (var cfg_i = 0; cfg_i < options.targets.length && matching_i == undefined; cfg_i++) {
      // string match (no globbing)
      if(options.targets[cfg_i].target == target_graphite.target) {
          matching_i = cfg_i;
      }
      // glob match?
      else if(target_graphite.target.graphiteGlob(options.targets[cfg_i].target)) {
          matching_i = cfg_i;
      }
    }

    if (matching_i == undefined) {
      console.error ("internal error: could not figure out which target_option target_graphite '" +
              target_graphite.target + "' comes from");
      return [];
    }

    return options.targets[matching_i];
  }

  function add_targets(options, response_data) {
    var all_targets = [];
    for (var res_i = 0; res_i < response_data.length; res_i++) {
      var target = find_definition(response_data[res_i], options);
      target.label = target.name; // flot wants 'label'
      target.data = [];
      var nulls = 0;
      var non_nulls = 0;
      for (var i in response_data[res_i].datapoints) {
        if(response_data[res_i].datapoints[i][0] == null) {
          nulls++;
          if('drawNullAsZero' in options && options['drawNullAsZero']) {
            response_data[res_i].datapoints[i][0] = 0;
          } else {
            // don't tell flot about null values, it prevents adjacent non-null values from
            // being rendered correctly
            continue;
          }
        } else {
          non_nulls++;
        }
        target.data.push([response_data[res_i].datapoints[i][1] * 1000, response_data[res_i].datapoints[i][0]]);
      }
      if (nulls/non_nulls > 0.3) {
        console.log("warning: rendered target contains " + nulls + " null values, " + non_nulls + " non_nulls");
      }
      all_targets.push(target);
    }

    return all_targets;
  }

  return {
    build_graphite_options: build_graphite_options,
    build_graphite_url: build_graphite_url,
    add_targets: add_targets
  };
});