/**
 * Created with IntelliJ IDEA.
 * User: Ganaraj.Pr
 * Date: 11/10/13
 * Time: 11:27
 * To change this template use File | Settings | File Templates.
 */

(function(){

function isDnDsSupported(){
    return 'draggable' in document.createElement("span");
}

if(!isDnDsSupported()){
    return;
}

if (window.jQuery && (-1 == window.jQuery.event.props.indexOf("dataTransfer"))) {
    window.jQuery.event.props.push("dataTransfer");
}

var currentData;

angular.module("ngDragDrop",[])
    .directive("uiDraggable", [
        '$parse',
        '$rootScope',
        '$dragImage',
        function ($parse, $rootScope, $dragImage) {
            return function (scope, element, attrs) {
                var dragData = "",
                    isDragHandleUsed = false,
                    dragHandleClass,
                    draggingClass = attrs.draggingClass || "on-dragging",
                    dragTarget;

                element.attr("draggable", false);

                attrs.$observe("uiDraggable", function (newValue) {
                    if(newValue){
                        element.attr("draggable", newValue);
                    }
                    else{
                        element.removeAttr("draggable");
                    }

                });

                if (attrs.drag) {
                    scope.$watch(attrs.drag, function (newValue) {
                        dragData = newValue || "";
                    });
                }

                if (angular.isString(attrs.dragHandleClass)) {
                    isDragHandleUsed = true;
                    dragHandleClass = attrs.dragHandleClass.trim() || "drag-handle";

                    element.bind("mousedown", function (e) {
                        dragTarget = e.target;
                    });
                }

                function dragendHandler(e) {
                    setTimeout(function() {
                      element.unbind('$destroy', dragendHandler);
                    }, 0);
                    var sendChannel = attrs.dragChannel || "defaultchannel";
                    $rootScope.$broadcast("ANGULAR_DRAG_END", sendChannel);
                    if (e.dataTransfer && e.dataTransfer.dropEffect !== "none") {
                        if (attrs.onDropSuccess) {
                            var fn = $parse(attrs.onDropSuccess);
                            scope.$apply(function () {
                                fn(scope, {$event: e});
                            });
                        } else {
                            if (attrs.onDropFailure) {
                                var fn = $parse(attrs.onDropFailure);
                                scope.$apply(function () {
                                    fn(scope, {$event: e});
                                });
                            }
                        }
                    }
                    element.removeClass(draggingClass);
                }

                element.bind("dragend", dragendHandler);

                element.bind("dragstart", function (e) {
                    var isDragAllowed = !isDragHandleUsed || dragTarget.classList.contains(dragHandleClass);

                    if (isDragAllowed) {
                        var sendChannel = attrs.dragChannel || "defaultchannel";
                        var sendData = angular.toJson({ data: dragData, channel: sendChannel });
                        var dragImage = attrs.dragImage || null;

                        element.addClass(draggingClass);
                        element.bind('$destroy', dragendHandler);

                        if (dragImage) {
                            var dragImageFn = $parse(attrs.dragImage);
                            scope.$apply(function() {
                                var dragImageParameters = dragImageFn(scope, {$event: e});
                                if (dragImageParameters) {
                                    if (angular.isString(dragImageParameters)) {
                                        dragImageParameters = $dragImage.generate(dragImageParameters);
                                    }
                                    if (dragImageParameters.image) {
                                        var xOffset = dragImageParameters.xOffset || 0,
                                            yOffset = dragImageParameters.yOffset || 0;
                                        e.dataTransfer.setDragImage(dragImageParameters.image, xOffset, yOffset);
                                    }
                                }
                            });
                        }

                        e.dataTransfer.setData("Text", sendData);
                        currentData = angular.fromJson(sendData);
                        e.dataTransfer.effectAllowed = "copyMove";
                        $rootScope.$broadcast("ANGULAR_DRAG_START", sendChannel);
                    }
                    else {
                        e.preventDefault();
                    }
                });
            };
        }
    ])
    .directive("uiOnDrop", [
        '$parse',
        '$rootScope',
        function ($parse, $rootScope) {
            return function (scope, element, attr) {
                var dragging = 0; //Ref. http://stackoverflow.com/a/10906204
                var dropChannel = attr.dropChannel || "defaultchannel" ;
                var dragChannel = "";
                var dragEnterClass = attr.dragEnterClass || "on-drag-enter";
                var dragHoverClass = attr.dragHoverClass || "on-drag-hover";

                function onDragOver(e) {
                    if (e.preventDefault) {
                        e.preventDefault(); // Necessary. Allows us to drop.
                    }

                    if (e.stopPropagation) {
                        e.stopPropagation();
                    }

                    e.dataTransfer.dropEffect = e.shiftKey ? 'copy' : 'move';
                    return false;
                }

                function onDragLeave(e) {
                  dragging--;
                  if (dragging == 0) {
                    element.removeClass(dragHoverClass);
                  }
                }

                function onDragEnter(e) {
                    dragging++;
                    $rootScope.$broadcast("ANGULAR_HOVER", dragChannel);
                    element.addClass(dragHoverClass);
                }

                function onDrop(e) {
                    if (e.preventDefault) {
                        e.preventDefault(); // Necessary. Allows us to drop.
                    }
                    if (e.stopPropagation) {
                        e.stopPropagation(); // Necessary. Allows us to drop.
                    }

                    var sendData = e.dataTransfer.getData("Text");
                    sendData = angular.fromJson(sendData);

                    var fn = $parse(attr.uiOnDrop);
                    scope.$apply(function () {
                        fn(scope, {$data: sendData.data, $event: e, $channel: sendData.channel});
                    });
                    element.removeClass(dragEnterClass);
                    dragging = 0;
                }

                function isDragChannelAccepted(dragChannel, dropChannel) {
                    if (dropChannel === "*") {
                        return true;
                    }

                    var channelMatchPattern = new RegExp("(\\s|[,])+(" + dragChannel + ")(\\s|[,])+", "i");

                    return channelMatchPattern.test("," + dropChannel + ",");
                }

                function preventNativeDnD(e) {
                    if (e.preventDefault) {
                        e.preventDefault();
                    }
                    if (e.stopPropagation) {
                        e.stopPropagation();
                    }
                    e.dataTransfer.dropEffect = "none";
                    return false;
                }

			var deregisterDragStart = $rootScope.$on("ANGULAR_DRAG_START", function (event, channel) {
                    dragChannel = channel;
                    if (isDragChannelAccepted(channel, dropChannel)) {
                        if (attr.dropValidate) {
                            var validateFn = $parse(attr.dropValidate);
                            var valid = validateFn(scope, {$data: currentData.data, $channel: currentData.channel});
                            if (!valid) {
                                element.bind("dragover", preventNativeDnD);
                                element.bind("dragenter", preventNativeDnD);
                                element.bind("dragleave", preventNativeDnD);
                                element.bind("drop", preventNativeDnD);
								return;
                            }
                        }

                        element.bind("dragover", onDragOver);
                        element.bind("dragenter", onDragEnter);
                        element.bind("dragleave", onDragLeave);

                        element.bind("drop", onDrop);
                        element.addClass(dragEnterClass);
                    }
					else {
					    element.bind("dragover", preventNativeDnD);
					    element.bind("dragenter", preventNativeDnD);
					    element.bind("dragleave", preventNativeDnD);
					    element.bind("drop", preventNativeDnD);
					}

                });



                var deregisterDragEnd = $rootScope.$on("ANGULAR_DRAG_END", function (e, channel) {
                    dragChannel = "";
                    if (isDragChannelAccepted(channel, dropChannel)) {

                        element.unbind("dragover", onDragOver);
                        element.unbind("dragenter", onDragEnter);
                        element.unbind("dragleave", onDragLeave);

                        element.unbind("drop", onDrop);
                        element.removeClass(dragHoverClass);
                        element.removeClass(dragEnterClass);
                    }

					element.unbind("dragover", preventNativeDnD);
					element.unbind("dragenter", preventNativeDnD);
					element.unbind("dragleave", preventNativeDnD);
					element.unbind("drop", preventNativeDnD);
                });


                var deregisterDragHover = $rootScope.$on("ANGULAR_HOVER", function (e, channel) {
                    if (isDragChannelAccepted(channel, dropChannel)) {
                      element.removeClass(dragHoverClass);
                    }
                });


                scope.$on('$destroy', function () {
                    deregisterDragStart();
                    deregisterDragEnd();
                    deregisterDragHover();
                });


                attr.$observe('dropChannel', function (value) {
                    if (value) {
                        dropChannel = value;
                    }
                });


            };
        }
    ])
    .constant("$dragImageConfig", {
        height: 20,
        width: 200,
        padding: 10,
        font: 'bold 11px Arial',
        fontColor: '#eee8d5',
        backgroundColor: '#93a1a1',
        xOffset: 0,
        yOffset: 0
    })
    .service("$dragImage", [
        '$dragImageConfig',
        function (defaultConfig) {
            var ELLIPSIS = '…';

            function fitString(canvas, text, config) {
                var width = canvas.measureText(text).width;
                if (width < config.width) {
                    return text;
                }
                while (width + config.padding > config.width) {
                    text = text.substring(0, text.length - 1);
                    width = canvas.measureText(text + ELLIPSIS).width;
                }
                return text + ELLIPSIS;
            };

            this.generate = function (text, options) {
                var config = angular.extend({}, defaultConfig, options || {});
                var el = document.createElement('canvas');

                el.height = config.height;
                el.width = config.width;

                var canvas = el.getContext('2d');

                canvas.fillStyle = config.backgroundColor;
                canvas.fillRect(0, 0, config.width, config.height);
                canvas.font = config.font;
                canvas.fillStyle = config.fontColor;

                var title = fitString(canvas, text, config);
                canvas.fillText(title, 4, config.padding + 4);

                var image = new Image();
                image.src = el.toDataURL();

                return {
                    image: image,
                    xOffset: config.xOffset,
                    yOffset: config.yOffset
                };
            }
        }
    ]);

}());
