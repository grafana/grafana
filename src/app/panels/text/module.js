/** @scratch /panels/5
 * include::panels/text.asciidoc[]
 */

/** @scratch /panels/text/0
 * == text
 * Status: *Stable*
 *
 * The text panel is used for displaying static text formated as markdown, html as plain
 * text or for writing grafana plug-ins.
 *
 */
define([
  'angular',
  'app',
  'underscore',
  'require'
],
function (angular, app, _, require) {
  'use strict';

  var providers = {};
  var module = angular.module('kibana.panels.text', [], function($controllerProvider, $compileProvider, $provide) {
    providers = {
      $controllerProvider: $controllerProvider,
      $compileProvider: $compileProvider,
      $provide: $provide
    };
  });
  app.useModule(module);

  module.controller('text', function($scope) {

    $scope.panelMeta = {
      description : "A static text panel that can use plain text, markdown, or HTML. Additionally, it is possible to write grafana plug-ins."
    };

    // Set and populate defaults
    var _d = {
      mode    : "markdown", // 'html', 'markdown', 'text', 'plugin'
      content : "",
      style: {},
    };

    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.initBaseController(this, $scope);

      $scope.ready = false;
    };

    $scope.render = function() {
      $scope.$emit('render');
    };

    $scope.openEditor = function() {
      //$scope.$emit('open-modal','paneleditor');
      console.log('scope id', $scope.$id);
    };

  });

  module.directive('markdown', function() {
    return {
      restrict: 'E',
      link: function(scope, element) {
        scope.$on('render', function() {
          render_panel();
        });

        function render_panel() {
          require(['./lib/showdown'], function (Showdown) {
            scope.ready = true;
            var converter = new Showdown.converter();
            var text = scope.panel.content.replace(/&/g, '&amp;')
              .replace(/>/g, '&gt;')
              .replace(/</g, '&lt;');
            var htmlText = converter.makeHtml(text);
            element.html(htmlText);
            // For whatever reason, this fixes chrome. I don't like it, I think
            // it makes things slow?
            if(!scope.$$phase) {
              scope.$apply();
            }
          });
        }

        render_panel();
      }
    };
  });

  module.filter('newlines', function(){
    return function (input) {
      return input.replace(/\n/g, '<br/>');
    };
  });

  module.filter('striphtml', function () {
    return function(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;');
    };
  });

  // thx to Maxim Shoustin
  // (http://stackoverflow.com/questions/19096239/ng-click-do-not-work-when-a-template-bound-using-ng-bind-html-unsafe#answer-19096506)
  module.directive( 'compileData', function ( $compile ) {
    return {
      scope: true,
      link: function ( scope, element, attrs ) {

        // thx to Jussi Kosunen
        // (http://stackoverflow.com/questions/15250644/angularjs-loading-a-controller-dynamically#answer-15292441)
        attrs.$observe( 'script', function ( script ) {
          // Store our _invokeQueue length before loading our controllers/directives/services
          // This is just so we don't re-register anything
          var queueLengthBefore = angular.module('kibana.panels.text')._invokeQueue.length;
          /*jshint -W061 */
          eval(script);
          dynamicallyRegisterComponents(queueLengthBefore);
        });

        var elmnt;
        attrs.$observe( 'template', function ( myTemplate ) {
          if ( angular.isDefined( myTemplate ) ) {
            // compile the provided template against the current scope
            elmnt = $compile( myTemplate )( scope );
            element.html(""); // dummy "clear"
            element.append( elmnt );
          }
        });
      }
    };
  });

  function dynamicallyRegisterComponents( queueLengthBefore ) {
    // Register the controls/directives/services we just loaded
    var queue = angular.module('kibana.panels.text')._invokeQueue;
    for (var i = queueLengthBefore; i < queue.length; i++) {
      var call = queue[i];
      // call is in the form [providerName, providerFunc, providerArguments]
      var provider = providers[call[0]];
      if (provider) {
        // e.g. $controllerProvider.register("Ctrl", function() { ... })
        provider[call[1]].apply(provider, call[2]);
      }
    }
  }
});