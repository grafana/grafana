'use strict';
/**
 * Bindonce - Zero watches binding for AngularJs
 * @version v0.2.1 - 2013-05-07
 * @link https://github.com/Pasvaz/bindonce
 * @author Pasquale Vazzana <pasqualevazzana@gmail.com>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */

 angular.module('pasvaz.bindonce', [])

 .directive('bindonce', function()
 {
  var toBoolean = function(value)
  {
    if (value && value.length !== 0)
    {
      var v = angular.lowercase("" + value);
      value = !(v == 'f' || v == '0' || v == 'false' || v == 'no' || v == 'n' || v == '[]');
    }
    else
    {
      value = false;
    }
    return value;
  }

  var msie = parseInt((/msie (\d+)/.exec(angular.lowercase(navigator.userAgent)) || [])[1], 10);
  if (isNaN(msie))
  {
    msie = parseInt((/trident\/.*; rv:(\d+)/.exec(angular.lowercase(navigator.userAgent)) || [])[1], 10);
  }

  var bindonceDirective =
  {
    restrict: "AM",
    controller: ['$scope', '$element', '$attrs', '$interpolate', function($scope, $element, $attrs, $interpolate)
    {
      var showHideBinder = function(elm, attr, value)
      {
        var show = (attr == 'show') ? '' : 'none';
        var hide = (attr == 'hide') ? '' : 'none';
        elm.css('display', toBoolean(value) ? show : hide);
      }
      var classBinder = function(elm, value)
      {
        if (angular.isObject(value) && !angular.isArray(value))
        {
          var results = [];
          angular.forEach(value, function(value, index)
          {
            if (value) results.push(index);
          });
          value = results;
        }
        if (value)
        {
          elm.addClass(angular.isArray(value) ? value.join(' ') : value);
        }
      }

      var ctrl =
      {
        watcherRemover : undefined,
        binders : [],
        group : $attrs.boName,
        element : $element,
        ran : false,

        addBinder : function(binder)
        {
          this.binders.push(binder);

          // In case of late binding (when using the directive bo-name/bo-parent)
          // it happens only when you use nested bindonce, if the bo-children
          // are not dom children the linking can follow another order
          if (this.ran)
          {
            this.runBinders();
          }
        },

        setupWatcher : function(bindonceValue)
        {
          var that = this;
          this.watcherRemover = $scope.$watch(bindonceValue, function(newValue)
          {
            if (newValue == undefined) return;
            that.removeWatcher();
            that.runBinders();
          }, true);
        },

        removeWatcher : function()
        {
          if (this.watcherRemover != undefined)
          {
            this.watcherRemover();
            this.watcherRemover = undefined;
          }
        },

        runBinders : function()
        {
          var i, max;
          for (i = 0, max = this.binders.length; i < max; i ++)
          {
            var binder = this.binders[i];
            if (this.group && this.group != binder.group ) continue;
            var value = binder.scope.$eval((binder.interpolate) ? $interpolate(binder.value) : binder.value);
            switch(binder.attr)
            {
              case 'if':
                if (toBoolean(value))
                {
                  binder.transclude(binder.scope.$new(), function (clone)
                  {
                    var parent = binder.element.parent();
                    var afterNode = binder.element && binder.element[binder.element.length - 1];
                    var parentNode = parent && parent[0] || afterNode && afterNode.parentNode;
                    var afterNextSibling = (afterNode && afterNode.nextSibling) || null;
                    angular.forEach(clone, function(node)
                    {
                      parentNode.insertBefore(node, afterNextSibling);
                    });
                  });
                }
                break;
              case 'hide':
              case 'show':
                showHideBinder(binder.element, binder.attr, value);
                break;
              case 'class':
                classBinder(binder.element, value);
                break;
              case 'text':
                binder.element.text(value);
                break;
              case 'html':
                binder.element.html(value);
                break;
              case 'style':
                binder.element.css(value);
                break;
              case 'src':
                binder.element.attr(binder.attr, value);
                if (msie) binder.element.prop('src', value);
              case 'attr':
                angular.forEach(binder.attrs, function(attrValue, attrKey)
                {
                  var newAttr, newValue;
                  if (attrKey.match(/^boAttr./) && binder.attrs[attrKey])
                  {
                    newAttr = attrKey.replace(/^boAttr/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
                    newValue = binder.scope.$eval(binder.attrs[attrKey]);
                    binder.element.attr(newAttr, newValue);
                  }
                });
                break;
              case 'href':
              case 'alt':
              case 'title':
              case 'id':
              case 'value':
                binder.element.attr(binder.attr, value);
                break;
            }
          }
          this.ran = true;
          this.binders = [];
        }
      }

      return ctrl;
    }],

    link: function(scope, elm, attrs, bindonceController)
    {
      var value = (attrs.bindonce) ? scope.$eval(attrs.bindonce) : true;
      if (value != undefined)
      {
        bindonceController.runBinders();
      }
      else
      {
        bindonceController.setupWatcher(attrs.bindonce);
        elm.bind("$destroy", bindonceController.removeWatcher);
      }
    }
  };

  return bindonceDirective;
});

angular.forEach(
[
  {directiveName:'boShow', attribute: 'show'},
  {directiveName:'boIf', attribute: 'if', transclude: 'element', terminal: true, priority:1000},
  {directiveName:'boHide', attribute:'hide'},
  {directiveName:'boClass', attribute:'class'},
  {directiveName:'boText', attribute:'text'},
  {directiveName:'boHtml', attribute:'html'},
  {directiveName:'boSrcI', attribute:'src', interpolate:true},
  {directiveName:'boSrc', attribute:'src'},
  {directiveName:'boHrefI', attribute:'href', interpolate:true},
  {directiveName:'boHref', attribute:'href'},
  {directiveName:'boAlt', attribute:'alt'},
  {directiveName:'boTitle', attribute:'title'},
  {directiveName:'boId', attribute:'id'},
  {directiveName:'boStyle', attribute:'style'},
  {directiveName:'boValue', attribute:'value'},
  {directiveName:'boAttr', attribute:'attr'}
],
function(boDirective)
{
  var childPriority = 200;
  return angular.module('pasvaz.bindonce').directive(boDirective.directiveName, function()
  {
    var bindonceDirective =
    {
      priority: boDirective.priority || childPriority,
      transclude: boDirective.transclude || false,
      terminal: boDirective.terminal || false,
      require: '^bindonce',
      compile: function (tElement, tAttrs, transclude)
      {
        return function(scope, elm, attrs, bindonceController)
        {
          var name = attrs.boParent;
          if (name && bindonceController.group != name)
          {
            var element = bindonceController.element.parent();
            bindonceController = undefined;
            var parentValue;

            while (element[0].nodeType != 9 && element.length)
            {
              if ((parentValue = element.data('$bindonceController'))
                && parentValue.group == name)
              {
                bindonceController = parentValue
                break;
              }
              element = element.parent();
            }
            if (!bindonceController)
            {
              throw Error("No bindonce controller: " + name);
            }
          }

          bindonceController.addBinder(
          {
            element   :   elm,
            attr    :   boDirective.attribute,
            attrs     :   attrs,
            value   :   attrs[boDirective.directiveName],
            interpolate :   boDirective.interpolate,
            group   :   name,
            transclude  :   transclude,
            scope   :   scope
          });
        }
      }
    }

    return bindonceDirective;
  });
});