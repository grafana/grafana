/*
  This has been modified from the default angular-draganddrop to provide the original
  model and some other stuff as the 'data' arguement to callEventCallback
*/

(function (window, angular, undefined) {
'use strict';

var jqyoui = angular.module('ngDragDrop', []).service('ngDragDropService', ['$timeout', '$parse', function($timeout, $parse) {
    this.callEventCallback = function (scope, callbackName, event, ui, data) {
      if (!callbackName) {
        return;
      }
      var args = [event, ui, data];
      var match = callbackName.match(/^(.+)\((.+)\)$/);
      if (match !== null) {
        callbackName = match[1];
        var values = eval('[' + match[0].replace(/^(.+)\(/, '').replace(/\)/, '') + ']');
        args.push.apply(args, values);
      }
      if(scope[callbackName]) {
        scope[callbackName].apply(scope, args);
      }
    };

    this.invokeDrop = function ($draggable, $droppable, event, ui) {
      var dragModel = '',
        dropModel = '',
        dragSettings = {},
        dropSettings = {},
        jqyoui_pos = null,
        dragItem = {},
        dropItem = {},
        dragModelValue,
        dropModelValue,
        $droppableDraggable = null,
        droppableScope = $droppable.scope(),
        draggableScope = $draggable.scope(),
        data = {};

      dragModel = $draggable.ngattr('ng-model');
      dropModel = $droppable.ngattr('ng-model');
      dragModelValue = draggableScope.$eval(dragModel);
      dropModelValue = droppableScope.$eval(dropModel);

      $droppableDraggable = $droppable.find('[jqyoui-draggable]:last');
      dropSettings = droppableScope.$eval($droppable.attr('jqyoui-droppable')) || [];
      dragSettings = draggableScope.$eval($draggable.attr('jqyoui-draggable')) || [];

      // Helps pick up the right item
      dragSettings.index = this.fixIndex(draggableScope, dragSettings, dragModelValue);
      dropSettings.index = this.fixIndex(droppableScope, dropSettings, dropModelValue);

      jqyoui_pos = angular.isArray(dragModelValue) ? dragSettings.index : null;
      dragItem = angular.isArray(dragModelValue) ? dragModelValue[jqyoui_pos] : dragModelValue;

      if (angular.isArray(dropModelValue) && dropSettings && dropSettings.index !== undefined) {
        dropItem = dropModelValue[dropSettings.index];
      } else if (!angular.isArray(dropModelValue)) {
        dropItem = dropModelValue;
      } else {
        dropItem = {};
      }

      data = {
        dragModel: dragModel,
        dropModel: dropModel,
        dragSettings: dragSettings,
        dropSettings: dropSettings,
        jqyoui_pos: jqyoui_pos,
        dragItem: dragItem,
        dropItem: dropItem,
        dragModelValue: dragModelValue,
        dropModelValue: dropModelValue,
        droppableScope: $droppable.scope(),
        draggableScope: $draggable.scope()
      };


      if (dragSettings.animate === true) {

        this.move($draggable, $droppableDraggable.length > 0 ? $droppableDraggable : $droppable, null, 'fast', dropSettings, null);
        this.move($droppableDraggable.length > 0 && !dropSettings.multiple ? $droppableDraggable : [], $draggable.parent('[jqyoui-droppable]'), jqyoui.startXY, 'fast', dropSettings, function() {
          $timeout(function() {
            // Do not move this into move() to avoid flickering issue
            $draggable.css({'position': 'relative', 'left': '', 'top': ''});
            $droppableDraggable.css({'position': 'relative', 'left': '', 'top': ''});

            if(dragSettings.mutate !== false) {
              this.mutateDraggable(draggableScope, dropSettings, dragSettings, dragModel, dropModel, dropItem, $draggable);
            }

            if(dropSettings.mutate !== false) {
              this.mutateDroppable(droppableScope, dropSettings, dragSettings, dropModel, dragItem, jqyoui_pos);
            }

            this.callEventCallback(droppableScope, dropSettings.onDrop, event, ui, data);
          }.bind(this));
        }.bind(this));
      } else {
        $timeout(function() {

          if(dragSettings.mutate !== false) {
            this.mutateDraggable(draggableScope, dropSettings, dragSettings, dragModel, dropModel, dropItem, $draggable);
          }

          if(dropSettings.mutate !== false) {
            this.mutateDroppable(droppableScope, dropSettings, dragSettings, dropModel, dragItem, jqyoui_pos);
          }

          this.callEventCallback(droppableScope, dropSettings.onDrop, event, ui, data);
        }.bind(this));
      }
    };

    this.move = function($fromEl, $toEl, toPos, duration, dropSettings, callback) {
      if ($fromEl.length === 0) {
        if (callback) {
          window.setTimeout(function() {
            callback();
          }, 300);
        }
        return false;
      }

      var zIndex = 9999,
        fromPos = $fromEl.offset(),
        wasVisible = $toEl && $toEl.is(':visible');

      if (toPos === null && $toEl.length > 0) {
        if ($toEl.attr('jqyoui-draggable') !== undefined && $toEl.ngattr('ng-model') !== undefined && $toEl.is(':visible') && dropSettings && dropSettings.multiple) {
          toPos = $toEl.offset();
          if (dropSettings.stack === false) {
            toPos.left+= $toEl.outerWidth(true);
          } else {
            toPos.top+= $toEl.outerHeight(true);
          }
        } else {
          toPos = $toEl.css({'visibility': 'hidden', 'display': 'block'}).offset();
          $toEl.css({'visibility': '','display': wasVisible ? '' : 'none'});
        }
      }

      $fromEl.css({'position': 'absolute', 'z-index': zIndex})
        .css(fromPos)
        .animate(toPos, duration, function() {
          if (callback) callback();
        });
    };

    this.mutateDroppable = function(scope, dropSettings, dragSettings, dropModel, dragItem, jqyoui_pos) {
      var dropModelValue = scope.$eval(dropModel);

      scope.__dragItem = dragItem;

      if (angular.isArray(dropModelValue)) {
        if (dropSettings && dropSettings.index >= 0) {
          dropModelValue[dropSettings.index] = dragItem;
        } else {
          dropModelValue.push(dragItem);
        }
        if (dragSettings && dragSettings.placeholder === true) {
          dropModelValue[dropModelValue.length - 1]['jqyoui_pos'] = jqyoui_pos;
        }
      } else {
        $parse(dropModel + ' = __dragItem')(scope);
        if (dragSettings && dragSettings.placeholder === true) {
          dropModelValue['jqyoui_pos'] = jqyoui_pos;
        }
      }
    };

    this.mutateDraggable = function(scope, dropSettings, dragSettings, dragModel, dropModel, dropItem, $draggable) {
      var isEmpty = angular.equals(angular.copy(dropItem), {}),
        dragModelValue = scope.$eval(dragModel);

      scope.__dropItem = dropItem;

      if (dragSettings && dragSettings.placeholder) {
        if (dragSettings.placeholder != 'keep'){
          if (angular.isArray(dragModelValue) && dragSettings.index !== undefined) {
            dragModelValue[dragSettings.index] = dropItem;
          } else {
            $parse(dragModel + ' = __dropItem')(scope);
          }
        }
      } else {
        if (angular.isArray(dragModelValue)) {
          if (isEmpty) {
            if (dragSettings && ( dragSettings.placeholder !== true && dragSettings.placeholder !== 'keep' )) {
              dragModelValue.splice(dragSettings.index, 1);
            }
          } else {
            dragModelValue[dragSettings.index] = dropItem;
          }
        } else {
          // Fix: LIST(object) to LIST(array) - model does not get updated using just scope[dragModel] = {...}
          // P.S.: Could not figure out why it happened
          $parse(dragModel + ' = __dropItem')(scope);
          if (scope.$parent) {
            $parse(dragModel + ' = __dropItem')(scope.$parent);
          }
        }
      }

      $draggable.css({'z-index': '', 'left': '', 'top': ''});
    };

    this.fixIndex = function(scope, settings, modelValue) {
      if (settings.applyFilter && angular.isArray(modelValue) && modelValue.length > 0) {
        var dragModelValueFiltered = scope[settings.applyFilter](),
            lookup = dragModelValueFiltered[settings.index],
            actualIndex = undefined;

        modelValue.forEach(function(item, i) {
           if (angular.equals(item, lookup)) {
             actualIndex = i;
           }
        });

        return actualIndex;
      }

      return settings.index;
    };
  }]).directive('jqyouiDraggable', ['ngDragDropService', function(ngDragDropService) {
    return {
      require: '?jqyouiDroppable',
      restrict: 'A',
      link: function(scope, element, attrs) {
        var dragSettings, zIndex;
        var updateDraggable = function(newValue, oldValue) {
          if (newValue) {
            dragSettings = scope.$eval(element.attr('jqyoui-draggable')) || [];
            element
              .draggable({disabled: false})
              .draggable(scope.$eval(attrs.jqyouiOptions) || {})
              .draggable({
                start: function(event, ui) {
                  zIndex = angular.element(this).css('z-index');
                  angular.element(this).css('z-index', 99999);
                  jqyoui.startXY = angular.element(this).offset();
                  ngDragDropService.callEventCallback(scope, dragSettings.onStart, event, ui);
                },
                stop: function(event, ui) {
                  angular.element(this).css('z-index', zIndex);
                  ngDragDropService.callEventCallback(scope, dragSettings.onStop, event, ui);
                },
                drag: function(event, ui) {
                  ngDragDropService.callEventCallback(scope, dragSettings.onDrag, event, ui);
                }
              });
          } else {
            element.draggable({disabled: true});
          }
        };
        scope.$watch(function() { return scope.$eval(attrs.drag); }, updateDraggable);
        updateDraggable();
      }
    };
  }]).directive('jqyouiDroppable', ['ngDragDropService', function(ngDragDropService) {
    return {
      restrict: 'A',
      priority: 1,
      link: function(scope, element, attrs) {
        var updateDroppable = function(newValue, oldValue) {
          if (newValue) {
            element
              .droppable({disabled: false})
              .droppable(scope.$eval(attrs.jqyouiOptions) || {})
              .droppable({
                over: function(event, ui) {
                  var dropSettings = scope.$eval(angular.element(this).attr('jqyoui-droppable')) || [];
                  ngDragDropService.callEventCallback(scope, dropSettings.onOver, event, ui);
                },
                out: function(event, ui) {
                  var dropSettings = scope.$eval(angular.element(this).attr('jqyoui-droppable')) || [];
                  ngDragDropService.callEventCallback(scope, dropSettings.onOut, event, ui);
                },
                drop: function(event, ui) {
                  if (angular.element(ui.draggable).ngattr('ng-model') && attrs.ngModel) {
                    ngDragDropService.invokeDrop(angular.element(ui.draggable), angular.element(this), event, ui);
                  } else {
                    ngDragDropService.callEventCallback(scope, (scope.$eval(angular.element(this).attr('jqyoui-droppable')) || []).onDrop, event, ui);
                  }
                }
              });
          } else {
            element.droppable({disabled: true});
          }
        };

        scope.$watch(function() { return scope.$eval(attrs.drop); }, updateDroppable);
        updateDroppable();
      }
    };
  }]);

  $.fn.ngattr = function(name, value) {
    var element = angular.element(this).get(0);

    return element.getAttribute(name) || element.getAttribute('data-' + name);
  };
})(window, window.angular);