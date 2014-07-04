define([
    'angular',
    'underscore',
    'jquery',
], function (angular, _, $) {
    'use strict';

    angular
        .module('kibana.directives')
        .directive('dalmatinerdbMgetEditor', function($compile) {

            var funcSpanTemplate = '<a gf-dropdown="mgetMenu" class="dropdown-toggle" ' +
                'data-toggle="dropdown">{{target.mget}}</a>';

            return {
                restrict: 'A',
                link: function postLink($scope, elem) {
                    var $funcLink = $(funcSpanTemplate);

                    $scope.mgetMenu = _.map($scope.mgets, function(func) {
                        return {
                            text: func,
                            click: "changeMGet('" + func + "');"
                        };
                    });

                    function addElementsAndCompile() {
                        $funcLink.appendTo(elem);
                        $compile(elem.contents())($scope);
                    }

                    addElementsAndCompile();

                }
            };

        });

});
