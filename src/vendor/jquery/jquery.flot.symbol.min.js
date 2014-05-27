/* Javascript plotting library for jQuery, version 0.8.3.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Licensed under the MIT license.

*/
(function($){function processRawData(plot,series,datapoints){var handlers={square:function(ctx,x,y,radius,shadow){var size=radius*Math.sqrt(Math.PI)/2;ctx.rect(x-size,y-size,size+size,size+size)},diamond:function(ctx,x,y,radius,shadow){var size=radius*Math.sqrt(Math.PI/2);ctx.moveTo(x-size,y);ctx.lineTo(x,y-size);ctx.lineTo(x+size,y);ctx.lineTo(x,y+size);ctx.lineTo(x-size,y)},triangle:function(ctx,x,y,radius,shadow){var size=radius*Math.sqrt(2*Math.PI/Math.sin(Math.PI/3));var height=size*Math.sin(Math.PI/3);ctx.moveTo(x-size/2,y+height/2);ctx.lineTo(x+size/2,y+height/2);if(!shadow){ctx.lineTo(x,y-height/2);ctx.lineTo(x-size/2,y+height/2)}},cross:function(ctx,x,y,radius,shadow){var size=radius*Math.sqrt(Math.PI)/2;ctx.moveTo(x-size,y-size);ctx.lineTo(x+size,y+size);ctx.moveTo(x-size,y+size);ctx.lineTo(x+size,y-size)}};var s=series.points.symbol;if(handlers[s])series.points.symbol=handlers[s]}function init(plot){plot.hooks.processDatapoints.push(processRawData)}$.plot.plugins.push({init:init,name:"symbols",version:"1.0"})})(jQuery);