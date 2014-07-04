define([
    'angular',
    'app',
    'underscore',
    'jquery'
], function (angular, app, _, $) {
    'use strict';

    angular
        .module('kibana.directives')
        .directive('dalmatinerAddFunc', function($compile) {
            var funcSpanTemplate = '<a gf-dropdown="functionAddMenu" class="dropdown-toggle" ' +
                'data-toggle="dropdown"></a>';
            var buttonTemplate = '<a  class="grafana-target-segment grafana-target-function dropdown-toggle"' +
                ' tabindex="1" gf-dropdown="functionMenu" data-toggle="dropdown"' +
                ' data-placement="top"><i class="icon-plus"></i></a>';

            return {
                link: function($scope, elem) {
                    var $funcLink = $(funcSpanTemplate);
                    var $button = $(buttonTemplate);
                    $funcLink.appendTo(elem);
                    $button.appendTo(elem);

                    $scope.functionAddMenu = _.map($scope.functions, function(func) {
                        return {
                            text: func,
                            click: "addFunction('" + func + "');"
                        };
                    });

                    $button.click(function() {
                        //$button.hide();
                        $funcLink.show();
                    });


                    $compile(elem.contents())($scope);
                }
            };
        });
});
