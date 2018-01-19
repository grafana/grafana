var composer = {
	tab: "\t",
	template: "",
	isFunc: function(scope)
	{
		if (!scope.title || typeof scope.depth === 'undefined')
			return false;

		return scope.title.indexOf("Test") === 0 && scope.depth === 0;
	},
	discardLastKey: false
};


$(function()
{
	// Begin layout sizing
	var headerHeight = $('header').outerHeight();
	var padding = $('#input, #output').css('padding-top').replace("px", "") * 2 + 1;
	var outputPlaceholder = $('#output').text();

	$(window).resize(function()
	{
		$('#input, #output').height($(window).height() - headerHeight - padding);
	});

	$(window).resize();
	// End layout sizing


	$('#input').keydown(function(e)
	{
		// 13=Enter, 16=Shift
		composer.discardLastKey = e.keyCode === 13
								|| e.keyCode === 16;
	}).keyup(function(e)
	{
		if (!composer.discardLastKey)
			generate($(this).val());
	});

	composer.template = $('#tpl-convey').text();

	tabOverride.set(document.getElementById('input'));
	$('#input').focus();
});



// Begin Markup.js custom pipes
Mark.pipes.recursivelyRender = function(val)
{
	return !val || val.length === 0 ? "\n" : Mark.up(composer.template, val);
}

Mark.pipes.indent = function(val)
{
	return new Array(val + 1).join("\t");
}

Mark.pipes.notTestFunc = function(scope)
{
	return !composer.isFunc(scope);
}

Mark.pipes.safeFunc = function(val)
{
	return val.replace(/[^a-z0-9_]/gi, '');
}

Mark.pipes.properCase = function(str)
{
	if (str.length === 0)
		return "";

	str = str.charAt(0).toUpperCase() + str.substr(1);

	if (str.length < 2)
		return str;

	return str.replace(/[\s_][a-z]+/g, function(txt)
	{
		return txt.charAt(0)
				+ txt.charAt(1).toUpperCase()
				+ txt.substr(2).toLowerCase();
	});
}

Mark.pipes.showImports = function(item)
{
	console.log(item);
	if (root.title === "(root)" && root.stories.length > 0)
		return 'import (\n\t"testing"\n\t. "github.com/smartystreets/goconvey/convey"\n)\n';
	else
		return "";
}
// End Markup.js custom pipes


function generate(input)
{
	var root = parseInput(input);
	$('#output').text(Mark.up(composer.template, root.stories));
	if (root.stories.length > 0 && root.stories[0].title.substr(0, 4) === "Test")
		$('#output').prepend('import (\n\t"testing"\n\t. "github.com/smartystreets/goconvey/convey"\n)\n\n');
}

function parseInput(input)
{
	lines = input.split("\n");

	if (!lines)
		return;

	var root = {
		title: "(root)",
		stories: []
	};

	for (i in lines)
	{
		line = lines[i];
		lineText = $.trim(line);

		if (!lineText)
			continue;

		// Figure out how deep to put this story
		indent = line.match(new RegExp("^" + composer.tab + "+"));
		tabs = indent ? indent[0].length / composer.tab.length : 0;

		// Starting at root, traverse into the right spot in the arrays
		var curScope = root, prevScope = root;
		for (j = 0; j < tabs && curScope.stories.length > 0; j++)
		{
			curScope = curScope.stories[curScope.stories.length - 1];
			prevScope = curScope;
		}

		// Don't go crazy, though! (avoid excessive indentation)
		if (tabs > curScope.depth + 1)
			tabs = curScope.depth + 1;

		// Only top-level Convey() calls need the *testing.T object passed in
		var showT = composer.isFunc(prevScope)
					|| (!composer.isFunc(curScope)
							&& tabs === 0);

		// Save the story at this scope
		curScope.stories.push({
			title: lineText.replace(/"/g, "\\\""),		// escape quotes
			stories: [],
			depth: tabs,
			showT: showT
		});
	}

	return root;
}

function suppress(event)
{
	if (!event)
		return false;
	if (event.preventDefault)
		event.preventDefault();
	if (event.stopPropagation)
		event.stopPropagation();
	event.cancelBubble = true;
	return false;
}
