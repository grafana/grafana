$(init);

$(window).load(function()
{
	// Things may shift after all the elements (images/fonts) are loaded
	// In Chrome, calling reframe() doesn't work (maybe a quirk); we need to trigger resize
	$(window).resize();
});

function init()
{
	log("Welcome to GoConvey!");
	log("Initializing interface");
	convey.overall = emptyOverall();
	loadTheme();
	$('body').show();
	initPoller();
	wireup();
	latest();
}

function loadTheme(thmID)
{
	var defaultTheme = "dark";
	var linkTagId = "themeRef";

	if (!thmID)
		thmID = get('theme') || defaultTheme;

	log("Initializing theme: " + thmID);

	if (!convey.config.themes[thmID])
	{
		replacement = Object.keys(convey.config.themes)[0] || defaultTheme;
		log("NOTICE: Could not find '" + thmID + "' theme; defaulting to '" + replacement + "'");
		thmID = replacement;
	}

	convey.theme = thmID;
	save('theme', convey.theme);

	var linkTag = $('#'+linkTagId);
	var fullPath = convey.config.themePath
					+ convey.config.themes[convey.theme].filename;

	if (linkTag.length === 0)
	{
		$('head').append('<link rel="stylesheet" href="'
			+ fullPath + '" id="themeRef">');
	}
	else
		linkTag.attr('href', fullPath);

	colorizeCoverageBars();
}

function initPoller()
{
	$(convey.poller).on('serverstarting', function(event)
	{
		log("Server is starting...");
		convey.status = "starting";
		showServerDown("Server starting");
		$('#run-tests').addClass('spin-slowly disabled');
	});

	$(convey.poller).on('pollsuccess', function(event, data)
	{
		if (convey.status !== "starting")
			hideServerDown();

		// These two if statements determine if the server is now busy
		// (and wasn't before) or is not busy (regardless of whether it was before)
		if ((!convey.status || convey.status === "idle")
				&& data.status && data.status !== "idle")
			$('#run-tests').addClass('spin-slowly disabled');
		else if (convey.status !== "idle" && data.status === "idle")
		{
			$('#run-tests').removeClass('spin-slowly disabled');
		}

		switch (data.status)
		{
			case "executing":
				$(convey.poller).trigger('serverexec', data);
				break;
			case "idle":
				$(convey.poller).trigger('serveridle', data);
				break;
		}

		convey.status = data.status;
	});

	$(convey.poller).on('pollfail', function(event, data)
	{
		log("Poll failed; server down");
		convey.status = "down";
		showServerDown("Server down");
	});

	$(convey.poller).on('serverexec', function(event, data)
	{
		log("Server status: executing");
		$('.favicon').attr('href', '/favicon.ico');	// indicates running tests
	});

	$(convey.poller).on('serveridle', function(event, data)
	{
		log("Server status: idle");
		log("Tests have finished executing");
		latest();
	});

	convey.poller.start();
}

function wireup()
{
	log("Wireup");

	customMarkupPipes();

	var themes = [];
	for (var k in convey.config.themes)
		themes.push({ id: k, name: convey.config.themes[k].name });
	$('#theme').html(render('tpl-theme-enum', themes));

	enumSel("theme", convey.theme);

	loadSettingsFromStorage();

	$('#stories').on('click', '.toggle-all-pkg', function(event)
	{
		if ($(this).closest('.story-pkg').data('pkg-state') === "expanded")
			collapseAll();
		else
			expandAll();
		return suppress(event);
	});

	// Wireup the settings switches
	$('.enum#theme').on('click', 'li:not(.sel)', function()
	{
		loadTheme($(this).data('theme'));
	});
	$('.enum#pkg-expand-collapse').on('click', 'li:not(.sel)', function()
	{
		var newSetting = $(this).data('pkg-expand-collapse');
		convey.packageStates = {};
		save('pkg-expand-collapse', newSetting);
		if (newSetting === "expanded")
			expandAll();
		else
			collapseAll();
	});
	$('.enum#show-debug-output').on('click', 'li:not(.sel)', function()
	{
		var newSetting = $(this).data('show-debug-output');
		save('show-debug-output', newSetting);
		setDebugOutputUI(newSetting);
	});
	$('.enum#ui-effects').on('click', 'li:not(.sel)', function()
	{
		var newSetting = $(this).data('ui-effects');
		convey.uiEffects = newSetting;
		save('ui-effects', newSetting);
	});
	// End settings wireup

	//wireup the notification-settings switches
	$('.enum#notification').on('click', 'li:not(.sel)', function()
	{
		var enabled = $(this).data('notification');
		log("Turning notifications " + enabled ? 'on' : 'off');
		save('notifications', enabled);

		if (notif() && 'Notification' in window)
		{
			if (Notification.permission !== 'denied')
			{
				Notification.requestPermission(function(per)
				{
					if (!('permission' in Notification))
					{
						Notification.permission = per;
					}
				});
			}
			else
				log("Permission denied to show desktop notification");
		}

		setNotifUI()
	});

	$('.enum#notification-level').on('click', 'li:not(.sel)', function()
	{
		var level = $(this).data('notification-level');
		convey.notificationLevel = level;
		save('notification-level', level);
	});
	// End notification-settings

	convey.layout.header = $('header').first();
	convey.layout.frame = $('.frame').first();
	convey.layout.footer = $('footer').last();

	updateWatchPath();

	$('#path').change(function()
	{
		// Updates the watched directory with the server and makes sure it exists
		var tb = $(this);
		var newpath = encodeURIComponent($.trim(tb.val()));
		$.post('/watch?root='+newpath)
			.done(function() { tb.removeClass('error'); })
			.fail(function() { tb.addClass('error'); });
		convey.framesOnSamePath = 1;
	});

	$('#run-tests').click(function()
	{
		var self = $(this);
		if (self.hasClass('spin-slowly') || self.hasClass('disabled'))
			return;
		log("Test run invoked from web UI");
		$.get("/execute");
	});

	$('#play-pause').click(function()
	{
		$.get('/pause');

		if ($(this).hasClass(convey.layout.selClass))
		{
			// Un-pausing
			if (!$('footer .replay').is(':visible'))
				$('footer .recording').show();
			$('footer .paused').hide();
			log("Resuming auto-execution of tests");
		}
		else
		{
			// Pausing
			$('footer .recording').hide();
			$('footer .paused').show();
			log("Pausing auto-execution of tests");
		}

		$(this).toggleClass("throb " + convey.layout.selClass);
	});

	$('#toggle-notif').click(function()
	{
		toggle($('.settings-notification'), $(this));
	});

	$('#show-history').click(function()
	{
		toggle($('.history'), $(this));
	});

	$('#show-settings').click(function()
	{
		toggle($('.settings-general'), $(this));
	});

	$('#show-gen').click(function() {
		var writer = window.open("/composer.html");
		if (window.focus)
			writer.focus();
	});

	$('.toggler').not('.narrow').prepend('<i class="fa fa-angle-up fa-lg"></i>');
	$('.toggler.narrow').prepend('<i class="fa fa-angle-down fa-lg"></i>');

	$('.toggler').not('.narrow').click(function()
	{
		var target = $('#' + $(this).data('toggle'));
		$('.fa-angle-down, .fa-angle-up', this).toggleClass('fa-angle-down fa-angle-up');
		target.toggle();
	});

	$('.toggler.narrow').click(function()
	{
		var target = $('#' + $(this).data('toggle'));
		$('.fa-angle-down, .fa-angle-up', this).toggleClass('fa-angle-down fa-angle-up');
		target.toggleClass('hide-narrow show-narrow');
	});

	// Enumerations are horizontal lists where one item can be selected at a time
	$('.enum').on('click', 'li', enumSel);

	// Start ticking time
	convey.intervals.time = setInterval(convey.intervalFuncs.time, 1000);
	convey.intervals.momentjs = setInterval(convey.intervalFuncs.momentjs, 5000);
	convey.intervalFuncs.time();

	// Ignore/un-ignore package
	$('#stories').on('click', '.fa.ignore', function(event)
	{
		var pkg = $(this).data('pkg');
		if ($(this).hasClass('disabled'))
			return;
		else if ($(this).hasClass('unwatch'))
			$.get("/ignore", { paths: pkg });
		else
			$.get("/reinstate", { paths: pkg });
		$(this).toggleClass('watch unwatch fa-eye fa-eye-slash clr-red');
		return suppress(event);
	});

	// Show "All" link when hovering the toggler on packages in the stories
	$('#stories').on({
		mouseenter: function() { $('.toggle-all-pkg', this).stop().show('fast'); },
		mouseleave: function() { $('.toggle-all-pkg', this).stop().hide('fast'); }
	}, '.pkg-toggle-container');

	// Toggle a package in the stories when clicked
	$('#stories').on('click', '.story-pkg', function(event)
	{
		togglePackage(this, true);
		return suppress(event);
	});

	// Select a story line when it is clicked
	$('#stories').on('click', '.story-line', function()
	{
		$('.story-line-sel').not(this).removeClass('story-line-sel');
		$(this).toggleClass('story-line-sel');
	});

	// Render a frame from the history when clicked
	$('.history .container').on('click', '.item', function(event)
	{
		var frame = getFrame($(this).data("frameid"));
		changeStatus(frame.overall.status, true);
		renderFrame(frame);
		$(this).addClass('selected');

		// Update current status down in the footer
		if ($(this).is(':first-child'))
		{
			// Now on current frame
			$('footer .replay').hide();

			if ($('#play-pause').hasClass(convey.layout.selClass))	// Was/is paused
				$('footer .paused').show();
			else
				$('footer .recording').show();		// Was/is recording
		}
		else
		{
			$('footer .recording, footer .replay').hide();
			$('footer .replay').show();
		}
		return suppress(event);
	});

	$('footer').on('click', '.replay', function()
	{
		// Clicking "REPLAY" in the corner should bring them back to the current frame
		// and hide, if visible, the history panel for convenience
		$('.history .item:first-child').click();
		if ($('#show-history').hasClass('sel'))
			$('#show-history').click();
	});

	// Keyboard shortcuts!
	$(document).keydown(function(e)
	{
		if (e.ctrlKey || e.metaKey || e.shiftKey)
			return;

		switch (e.keyCode)
		{
			case 67:		// c
				$('#show-gen').click();
				break;
			case 82:		// r
				$('#run-tests').click();
				break;
			case 78:		// n
				$('#toggle-notif').click();
				break;
			case 87:		// w
				$('#path').focus();
				break;
			case 80:		// p
				$('#play-pause').click();
				break;
		}

		return suppress(e);
	});
	$('body').on('keydown', 'input, textarea, select', function(e)
	{
		// If user is typing something, don't let this event bubble
		// up to the document to annoyingly fire keyboard shortcuts
		e.stopPropagation();
	});

	// Wire-up the tipsy tooltips
	setTooltips();

	// Keep everything positioned and sized properly on window resize
	reframe();
	$(window).resize(reframe);
}

function setTooltips()
{
	var tips = {
		'#path': { delayIn: 500 },
		'#logo': { gravity: 'w' },
		'.controls li, .pkg-cover-name': { live: false },
		'footer .replay': { live: false, gravity: 'e' },
		'.ignore': { live: false, gravity: $.fn.tipsy.autoNS },
		'.disabled': { live: false, gravity: $.fn.tipsy.autoNS }
	};

	for (var key in tips)
	{
		$(key).each(function(el)
		{
			if(!$(this).tipsy(true))
				$(this).tipsy(tips[key]);
		});
	}
}

function setDebugOutputUI(newSetting){
	var $storyLine = $('.story-line');
	switch(newSetting) {
		case 'hide':
			$('.message', $storyLine).hide();
			break;
		case 'fail':
			$('.message', $storyLine.not('.fail, .panic')).hide();
			$('.message', $storyLine.filter('.fail, .panic')).show();
			break;
		default:
			$('.message', $storyLine).show();
			break;
	}
}

function setNotifUI()
{
	var $toggleNotif = $('#toggle-notif').addClass(notif() ? "fa-bell" : "fa-bell-o");
	$toggleNotif.removeClass(!notif() ? "fa-bell" : "fa-bell-o");
}

function expandAll()
{
	$('.story-pkg').each(function() { expandPackage($(this).data('pkg')); });
}

function collapseAll()
{
	$('.story-pkg').each(function() { collapsePackage($(this).data('pkg')); });
}

function expandPackage(pkgId)
{
	var pkg = $('.story-pkg.pkg-'+pkgId);
	var rows = $('.story-line.pkg-'+pkgId);

	pkg.data('pkg-state', "expanded").addClass('expanded').removeClass('collapsed');

	$('.pkg-toggle', pkg)
		.addClass('fa-minus-square-o')
		.removeClass('fa-plus-square-o');

	rows.show();
}

function collapsePackage(pkgId)
{
	var pkg = $('.story-pkg.pkg-'+pkgId);
	var rows = $('.story-line.pkg-'+pkgId);

	pkg.data('pkg-state', "collapsed").addClass('collapsed').removeClass('expanded');

	$('.pkg-toggle', pkg)
		.addClass('fa-plus-square-o')
		.removeClass('fa-minus-square-o');

	rows.hide();
}

function togglePackage(storyPkgElem)
{
	var pkgId = $(storyPkgElem).data('pkg');
	if ($(storyPkgElem).data('pkg-state') === "expanded")
	{
		collapsePackage(pkgId);
		convey.packageStates[$(storyPkgElem).data('pkg-name')] = "collapsed";
	}
	else
	{
		expandPackage(pkgId);
		convey.packageStates[$(storyPkgElem).data('pkg-name')] = "expanded";
	}
}

function loadSettingsFromStorage()
{
	var pkgExpCollapse = get("pkg-expand-collapse");
	if (!pkgExpCollapse)
	{
		pkgExpCollapse = "expanded";
		save("pkg-expand-collapse", pkgExpCollapse);
	}
	enumSel("pkg-expand-collapse", pkgExpCollapse);

	var showDebugOutput = get("show-debug-output");
	if (!showDebugOutput)
	{
		showDebugOutput = "show";
		save("show-debug-output", showDebugOutput);
	}
	enumSel("show-debug-output", showDebugOutput);

	var uiEffects = get("ui-effects");
	if (uiEffects === null)
		uiEffects = "true";
	convey.uiEffects = uiEffects === "true";
	enumSel("ui-effects", uiEffects);

	enumSel("notification", ""+notif());
	var notifLevel = get("notification-level");
	if (notifLevel === null) 
	{
		notifLevel = '.*';
	}
	convey.notificationLevel = notifLevel;
	enumSel("notification-level", notifLevel);

	setNotifUI();
}











function latest()
{
	log("Fetching latest test results");
	$.getJSON("/latest", process);
}

function process(data, status, jqxhr)
{
	if (!data || !data.Revision)
	{
		log("No data received or revision timestamp was missing");
		return;
	}

	if (data.Paused && !$('#play-pause').hasClass(convey.layout.selClass))
	{
		$('footer .recording').hide();
		$('footer .paused').show();
		$('#play-pause').toggleClass("throb " + convey.layout.selClass);
	}

	if (current() && data.Revision === current().results.Revision)
	{
		log("No changes");
		changeStatus(current().overall.status);	// re-assures that status is unchanged
		return;
	}


	// Put the new frame in the queue so we can use current() to get to it
	convey.history.push(newFrame());
	convey.framesOnSamePath++;

	// Store the raw results in our frame
	current().results = data;

	log("Updating watch path");
	updateWatchPath();

	// Remove all templated items from the DOM as we'll
	// replace them with new ones; also remove tipsy tooltips
	// that may have lingered around
	$('.templated, .tipsy').remove();

	var uniqueID = 0;
	var coverageAvgHelper = { countedPackages: 0, coverageSum: 0 };
	var packages = {
		tested: [],
		ignored: [],
		coverage: {},
		nogofiles: [],
		notestfiles: [],
		notestfn: []
	};

	log("Compiling package statistics");

	// Look for failures and panics through the packages->tests->stories...
	for (var i in data.Packages)
	{
		pkg = makeContext(data.Packages[i]);
		current().overall.duration += pkg.Elapsed;
		pkg._id = uniqueID++;

		if (pkg.Outcome === "build failure")
		{
			current().overall.failedBuilds++;
			current().failedBuilds.push(pkg);
			continue;
		}


		if (pkg.Outcome === "no go code")
			packages.nogofiles.push(pkg);
		else if (pkg.Outcome === "no test files")
			packages.notestfiles.push(pkg);
		else if (pkg.Outcome === "no test functions")
			packages.notestfn.push(pkg);
		else if (pkg.Outcome === "ignored" || pkg.Outcome === "disabled")
			packages.ignored.push(pkg);
		else
		{
			if (pkg.Coverage >= 0)
				coverageAvgHelper.coverageSum += pkg.Coverage;
			coverageAvgHelper.countedPackages++;
			packages.coverage[pkg.PackageName] = pkg.Coverage;
			packages.tested.push(pkg);
		}


		for (var j in pkg.TestResults)
		{
			test = makeContext(pkg.TestResults[j]);
			test._id = uniqueID++;
			test._pkgid = pkg._id;
			test._pkg = pkg.PackageName;

			if (test.Stories.length === 0)
			{
				// Here we've got ourselves a classic Go test,
				// not a GoConvey test that has stories and assertions
				// so we'll treat this whole test as a single assertion
				current().overall.assertions++;

				if (test.Error)
				{
					test._status = convey.statuses.panic;
					pkg._panicked++;
					test._panicked++;
					current().assertions.panicked.push(test);
				}
				else if (test.Passed === false)
				{
					test._status = convey.statuses.fail;
					pkg._failed++;
					test._failed++;
					current().assertions.failed.push(test);
				}
				else if (test.Skipped)
				{
					test._status = convey.statuses.skipped;
					pkg._skipped++;
					test._skipped++;
					current().assertions.skipped.push(test);
				}
				else
				{
					test._status = convey.statuses.pass;
					pkg._passed++;
					test._passed++;
					current().assertions.passed.push(test);
				}
			}
			else
				test._status = convey.statuses.pass;

			var storyPath = [{ Depth: -1, Title: test.TestName, _id: test._id }];	// Maintains the current assertion's story as we iterate

			for (var k in test.Stories)
			{
				var story = makeContext(test.Stories[k]);

				story._id = uniqueID;
				story._pkgid = pkg._id;
				current().overall.assertions += story.Assertions.length;

				// Establish the current story path so we can report the context
				// of failures and panicks more conveniently at the top of the page
				if (storyPath.length > 0)
					for (var x = storyPath[storyPath.length - 1].Depth; x >= test.Stories[k].Depth; x--)
						storyPath.pop();
				storyPath.push({ Depth: test.Stories[k].Depth, Title: test.Stories[k].Title, _id: test.Stories[k]._id });


				for (var l in story.Assertions)
				{
					var assertion = story.Assertions[l];
					assertion._id = uniqueID;
					assertion._pkg = pkg.PackageName;
					assertion._pkgId = pkg._id;
					assertion._failed = !!assertion.Failure;
					assertion._panicked = !!assertion.Error;
					assertion._maxDepth = storyPath[storyPath.length - 1].Depth;
					$.extend(assertion._path = [], storyPath);

					if (assertion.Failure)
					{
						current().assertions.failed.push(assertion);
						pkg._failed++;
						test._failed++;
						story._failed++;
					}
					if (assertion.Error)
					{
						current().assertions.panicked.push(assertion);
						pkg._panicked++;
						test._panicked++;
						story._panicked++;
					}
					if (assertion.Skipped)
					{
						current().assertions.skipped.push(assertion);
						pkg._skipped++;
						test._skipped++;
						story._skipped++;
					}
					if (!assertion.Failure && !assertion.Error && !assertion.Skipped)
					{
						current().assertions.passed.push(assertion);
						pkg._passed++;
						test._passed++;
						story._passed++;
					}
				}

				assignStatus(story);
				uniqueID++;
			}

			if (!test.Passed && !test._failed && !test._panicked)
			{
				// Edge case: Developer is using the GoConvey DSL, but maybe
				// in some cases is using t.Error() instead of So() assertions.
				// This can be detected, assuming all child stories with
				// assertions (in this test) are passing.
				test._status = convey.statuses.fail;
				pkg._failed++;
				test._failed++;
				current().assertions.failed.push(test);
			}
		}
	}

	current().overall.passed = current().assertions.passed.length;
	current().overall.panics = current().assertions.panicked.length;
	current().overall.failures = current().assertions.failed.length;
	current().overall.skipped = current().assertions.skipped.length;

	current().overall.coverage = Math.round((coverageAvgHelper.coverageSum / (coverageAvgHelper.countedPackages || 1)) * 100) / 100;
	current().overall.duration = Math.round(current().overall.duration * 1000) / 1000;

	// Compute the coverage delta (difference in overall coverage between now and last frame)
	// Only compare coverage on the same watch path
	var coverDelta = current().overall.coverage;
	if (convey.framesOnSamePath > 2)
		coverDelta = current().overall.coverage - convey.history[convey.history.length - 2].overall.coverage;
	current().coverDelta = Math.round(coverDelta * 100) / 100;


	// Build failures trump panics,
	// Panics trump failures,
	// Failures trump pass.
	if (current().overall.failedBuilds)
		changeStatus(convey.statuses.buildfail);
	else if (current().overall.panics)
		changeStatus(convey.statuses.panic);
	else if (current().overall.failures)
		changeStatus(convey.statuses.fail);
	else
		changeStatus(convey.statuses.pass);

	// Save our organized package lists
	current().packages = packages;

	log("    Assertions: " + current().overall.assertions);
	log("        Passed: " + current().overall.passed);
	log("       Skipped: " + current().overall.skipped);
	log("      Failures: " + current().overall.failures);
	log("        Panics: " + current().overall.panics);
	log("Build Failures: " + current().overall.failedBuilds);
	log("      Coverage: " + current().overall.coverage + "% (" + showCoverDelta(current().coverDelta) + ")");

	// Save timestamp when this test was executed
	convey.moments['last-test'] = moment();



	// Render... render ALL THE THINGS! (All model/state modifications are DONE!)
	renderFrame(current());
	// Now, just finish up miscellaneous UI things


	// Add this frame to the history pane
	var framePiece = render('tpl-history', current());
	$('.history .container').prepend(framePiece);
	$('.history .item:first-child').addClass('selected');
	convey.moments['frame-'+current().id] = moment();
	if (convey.history.length > convey.maxHistory)
	{
		// Delete the oldest frame out of the history pane if we have too many
		convey.history.splice(0, 1);
		$('.history .container .item').last().remove();
	}

	// Now add the momentjs time to the new frame in the history
	convey.intervalFuncs.momentjs();

	// Show notification, if enabled
	var levelRegex = new RegExp("("+convey.notificationLevel+")", "i");
	if (notif() && current().overall.status.class.match(levelRegex))
	{
		log("Showing notification");
		if (convey.notif)
		{
			clearTimeout(convey.notifTimer);
			convey.notif.close();
		}

		var notifText = notifSummary(current());

		convey.notif = new Notification(notifText.title, {
			body: notifText.body,
			icon: $('.favicon').attr('href')
		});

                convey.notif.onclick = function() { 
                  window.focus(); 
                };

		convey.notifTimer = setTimeout(function() { convey.notif.close(); }, 5000);
	}

	// Update title in title bar
	if (current().overall.passed === current().overall.assertions && current().overall.status.class === "ok")
		$('title').text("GoConvey (ALL PASS)");
	else
		$('title').text("GoConvey [" + current().overall.status.text + "] " + current().overall.passed + "/" + current().overall.assertions);

	setTooltips();

	// All done!
	log("Processing complete");
}

// Updates the entire UI given a frame from the history
function renderFrame(frame)
{
	log("Rendering frame (id: " + frame.id + ")");

	$('#coverage').html(render('tpl-coverage', frame.packages.tested.sort(sortPackages)));
	$('#ignored').html(render('tpl-ignored', frame.packages.ignored.sort(sortPackages)));
	$('#nogofiles').html(render('tpl-nogofiles', frame.packages.nogofiles.sort(sortPackages)));
	$('#notestfiles').html(render('tpl-notestfiles', frame.packages.notestfiles.sort(sortPackages)));
	$('#notestfn').html(render('tpl-notestfn', frame.packages.notestfn.sort(sortPackages)));

	if (frame.overall.failedBuilds)
	{
		$('.buildfailures').show();
		$('#buildfailures').html(render('tpl-buildfailures', frame.failedBuilds));
	}
	else
		$('.buildfailures').hide();

	if (frame.overall.panics)
	{
		$('.panics').show();
		$('#panics').html(render('tpl-panics', frame.assertions.panicked));
	}
	else
		$('.panics').hide();


	if (frame.overall.failures)
	{
		$('.failures').show();
		$('#failures').html(render('tpl-failures', frame.assertions.failed));
		$(".failure").each(function() {
			$(this).prettyTextDiff();
		});
	}
	else
		$('.failures').hide();

	$('#stories').html(render('tpl-stories', frame.packages.tested.sort(sortPackages)));
	$('#stories').append(render('tpl-stories', frame.packages.ignored.sort(sortPackages)));

	var pkgDefaultView = get('pkg-expand-collapse');
	$('.story-pkg.expanded').each(function()
	{
		if (pkgDefaultView === "collapsed" && convey.packageStates[$(this).data('pkg-name')] !== "expanded")
			collapsePackage($(this).data('pkg'));
	});

	redrawCoverageBars();

	$('#assert-count').html("<b>"+frame.overall.assertions+"</b> assertion"
							+ (frame.overall.assertions !== 1 ? "s" : ""));
	$('#skip-count').html("<b>"+frame.assertions.skipped.length + "</b> skipped");
	$('#fail-count').html("<b>"+frame.assertions.failed.length + "</b> failed");
	$('#panic-count').html("<b>"+frame.assertions.panicked.length + "</b> panicked");
	$('#duration').html("<b>"+frame.overall.duration + "</b>s");

	$('#narrow-assert-count').html("<b>"+frame.overall.assertions+"</b>");
	$('#narrow-skip-count').html("<b>"+frame.assertions.skipped.length + "</b>");
	$('#narrow-fail-count').html("<b>"+frame.assertions.failed.length + "</b>");
	$('#narrow-panic-count').html("<b>"+frame.assertions.panicked.length + "</b>");

	$('.history .item').removeClass('selected');


	setDebugOutputUI(get('show-debug-output'));

	log("Rendering finished");
}







function enumSel(id, val)
{
	if (typeof id === "string" && typeof val === "string")
	{
		$('.enum#'+id+' > li').each(function()
		{
			if ($(this).data(id).toString() === val)
			{
				$(this).addClass(convey.layout.selClass).siblings().removeClass(convey.layout.selClass);
				return false;
			}
		});
	}
	else
		$(this).addClass(convey.layout.selClass).siblings().removeClass(convey.layout.selClass);
}

function toggle(jqelem, switchelem)
{
	var speed = 250;
	var transition = 'easeInOutQuart';
	var containerSel = '.container';

	if (!jqelem.is(':visible'))
	{
		$(containerSel, jqelem).css('opacity', 0);
		jqelem.stop().slideDown(speed, transition, function()
		{
			if (switchelem)
				switchelem.toggleClass(convey.layout.selClass);
			$(containerSel, jqelem).stop().animate({
				opacity: 1
			}, speed);
			reframe();
		});
	}
	else
	{
		$(containerSel, jqelem).stop().animate({
			opacity: 0
		}, speed, function()
		{
			if (switchelem)
				switchelem.toggleClass(convey.layout.selClass);
			jqelem.stop().slideUp(speed, transition, function() { reframe(); });
		});
	}
}

function changeStatus(newStatus, isHistoricalFrame)
{
	if (!newStatus || !newStatus.class || !newStatus.text)
		newStatus = convey.statuses.pass;

	var sameStatus = newStatus.class === convey.overallClass;

	// The CSS class .flash and the jQuery UI 'pulsate' effect don't play well together.
	// This series of callbacks does the flickering/pulsating as well as
	// enabling/disabling flashing in the proper order so that they don't overlap.
	// TODO: I suppose the pulsating could also be done with just CSS, maybe...?

	if (convey.uiEffects)
	{
		var times = sameStatus ? 3 : 2;
		var duration = sameStatus ? 500 : 300;

		$('.overall .status').removeClass('flash').effect("pulsate", {times: times}, duration, function()
		{
			$(this).text(newStatus.text);

			if (newStatus !== convey.statuses.pass)	// only flicker extra when not currently passing
			{
				$(this).effect("pulsate", {times: 1}, 300, function()
				{
					$(this).effect("pulsate", {times: 1}, 500, function()
					{
						if (newStatus === convey.statuses.panic
								|| newStatus === convey.statuses.buildfail)
							$(this).addClass('flash');
						else
							$(this).removeClass('flash');
					});
				});
			}
		});
	}
	else
		$('.overall .status').text(newStatus.text);

	if (!sameStatus)	// change the color
		$('.overall').switchClass(convey.overallClass, newStatus.class, 1000);

	if (!isHistoricalFrame)
		current().overall.status = newStatus;
	convey.overallClass = newStatus.class;
	$('.favicon').attr('href', '/resources/ico/goconvey-'+newStatus.class+'.ico');
}

function updateWatchPath()
{
	$.get("/watch", function(data)
	{
		var newPath = $.trim(data);
		if (newPath !== $('#path').val())
			convey.framesOnSamePath = 1;
		$('#path').val(newPath);
	});
}

function notifSummary(frame)
{
	var body = frame.overall.passed + " passed, ";

	if (frame.overall.failedBuilds)
		body += frame.overall.failedBuilds + " build" + (frame.overall.failedBuilds !== 1 ? "s" : "") + " failed, ";
	if (frame.overall.failures)
		body += frame.overall.failures + " failed, ";
	if (frame.overall.panics)
		body += frame.overall.panics + " panicked, ";
	body += frame.overall.skipped + " skipped";

	body += "\r\n" + frame.overall.duration + "s";

	if (frame.coverDelta > 0)
		body += "\r\n↑ coverage (" + showCoverDelta(frame.coverDelta) + ")";
	else if (frame.coverDelta < 0)
		body += "\r\n↓ coverage (" + showCoverDelta(frame.coverDelta) + ")";

	return {
		title: frame.overall.status.text.toUpperCase(),
		body: body
	};
}

function redrawCoverageBars()
{
	$('.pkg-cover-bar').each(function()
	{
		var pkgName = $(this).data("pkg");
		var hue = $(this).data("width");
		var hueDiff = hue;

		if (convey.history.length > 1)
		{
			var oldHue = convey.history[convey.history.length - 2].packages.coverage[pkgName] || 0;
			$(this).width(oldHue + "%");
			hueDiff = hue - oldHue;
		}

		$(this).animate({
			width: "+=" + hueDiff + "%"
		}, 1250);
	});

	colorizeCoverageBars();
}

function colorizeCoverageBars()
{
	var colorTpl = convey.config.themes[convey.theme].coverage
					|| "hsla({{hue}}, 75%, 30%, .3)";	//default color template

	$('.pkg-cover-bar').each(function()
	{
		var hue = $(this).data("width");
		$(this).css({
			background: colorTpl.replace("{{hue}}", hue)
		});
	});
}


function getFrame(id)
{
	for (var i in convey.history)
		if (convey.history[i].id === id)
			return convey.history[i];
}

function render(templateID, context)
{
	var tpl = $('#' + templateID).text();
	return $($.trim(Mark.up(tpl, context)));
}

function reframe()
{
	var heightBelowHeader = $(window).height() - convey.layout.header.outerHeight();
	var middleHeight = heightBelowHeader - convey.layout.footer.outerHeight();
	convey.layout.frame.height(middleHeight);

	var pathWidth = $(window).width() - $('#logo').outerWidth() - $('#control-buttons').outerWidth() - 10;
	$('#path-container').width(pathWidth);
}

function notif()
{
	return get('notifications') === "true";	// stored as strings
}

function showServerDown(message)
{
	$('.server-down .notice-message').text(message);
	$('.server-down').show();
	$('.server-not-down').hide();
	reframe();
}

function hideServerDown()
{
	$('.server-down').hide();
	$('.server-not-down').show();
	reframe();
}

function log(msg)
{
	var jqLog = $('#log');
	if (jqLog.length > 0)
	{
		var t = new Date();
		var h = zerofill(t.getHours(), 2);
		var m = zerofill(t.getMinutes(), 2);
		var s = zerofill(t.getSeconds(), 2);
		var ms = zerofill(t.getMilliseconds(), 3);
		date = h + ":" + m + ":" + s + "." + ms;

		$(jqLog).append(render('tpl-log-line', { time: date, msg: msg }));
		$(jqLog).parent('.col').scrollTop(jqLog[0].scrollHeight);
	}
	else
		console.log(msg);
}

function zerofill(val, count)
{
	// Cheers to http://stackoverflow.com/a/9744576/1048862
	var pad = new Array(1 + count).join('0');
	return (pad + val).slice(-pad.length);
}

// Sorts packages ascending by only the last part of their name
// Can be passed into Array.sort()
function sortPackages(a, b)
{
	var aPkg = splitPathName(a.PackageName);
	var bPkg = splitPathName(b.PackageName);

	if (aPkg.length === 0 || bPkg.length === 0)
		return 0;

	var aName = aPkg.parts[aPkg.parts.length - 1].toLowerCase();
	var bName = bPkg.parts[bPkg.parts.length - 1].toLowerCase();

	if (aName < bName)
		return -1;
	else if (aName > bName)
		return 1;
	else
		return 0;

	/*
	MEMO: Use to sort by entire package name:
	if (a.PackageName < b.PackageName) return -1;
	else if (a.PackageName > b.PackageName) return 1;
	else return 0;
	*/
}

function get(key)
{
	var val = localStorage.getItem(key);
	if (val && (val[0] === '[' || val[0] === '{'))
		return JSON.parse(val);
	else
		return val;
}

function save(key, val)
{
	if (typeof val === 'object')
		val = JSON.stringify(val);
	else if (typeof val === 'number' || typeof val === 'boolean')
		val = val.toString();
	localStorage.setItem(key, val);
}

function splitPathName(str)
{
	var delim = str.indexOf('\\') > -1 ? '\\' : '/';
	return { delim: delim, parts: str.split(delim) };
}

function newFrame()
{
	return {
		results: {},					// response from server (with some of our own context info)
		packages: {},					// packages organized into statuses for convenience (like with coverage)
		overall: emptyOverall(),		// overall status info, compiled from server's response
		assertions: emptyAssertions(),	// lists of assertions, compiled from server's response
		failedBuilds: [],				// list of packages that failed to build
		timestamp: moment(),			// the timestamp of this "freeze-state"
		id: convey.frameCounter++,		// unique ID for this frame
		coverDelta: 0					// difference in total coverage from the last frame to this one
	};
}

function emptyOverall()
{
	return {
		status: {},
		duration: 0,
		assertions: 0,
		passed: 0,
		panics: 0,
		failures: 0,
		skipped: 0,
		failedBuilds: 0,
		coverage: 0
	};
}

function emptyAssertions()
{
	return {
		passed: [],
		failed: [],
		panicked: [],
		skipped: []
	};
}

function makeContext(obj)
{
	obj._passed = 0;
	obj._failed = 0;
	obj._panicked = 0;
	obj._skipped = 0;
	obj._status = '';
	return obj;
}

function current()
{
	return convey.history[convey.history.length - 1];
}

function assignStatus(obj)
{
	if (obj._skipped)
		obj._status = 'skip';
	else if (obj.Outcome === "ignored")
		obj._status = convey.statuses.ignored;
	else if (obj._panicked)
		obj._status = convey.statuses.panic;
	else if (obj._failed || obj.Outcome === "failed")
		obj._status = convey.statuses.fail;
	else
		obj._status = convey.statuses.pass;
}

function showCoverDelta(delta)
{
	if (delta > 0)
		return "+" + delta + "%";
	else if (delta === 0)
		return "±" + delta + "%";
	else
		return delta + "%";
}

function customMarkupPipes()
{
	// MARKUP.JS custom pipes
	Mark.pipes.relativePath = function(str)
	{
		basePath = new RegExp($('#path').val()+'[\\/]', 'gi');
		return str.replace(basePath, '');
	};
	Mark.pipes.htmlSafe = function(str)
	{
		return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
	};
	Mark.pipes.ansiColours = ansispan;
	Mark.pipes.boldPkgName = function(str)
	{
		var pkg = splitPathName(str);
		pkg.parts[0] = '<span class="not-pkg-name">' + pkg.parts[0];
		pkg.parts[pkg.parts.length - 1] = "</span><b>" + pkg.parts[pkg.parts.length - 1] + "</b>";
		return pkg.parts.join(pkg.delim);
	};
	Mark.pipes.needsDiff = function(test)
	{
		return !!test.Failure && (test.Expected !== "" || test.Actual !== "");
	};
	Mark.pipes.coveragePct = function(str)
	{
		// Expected input: 75% to be represented as: "75.0"
		var num = parseInt(str);	// we only need int precision
		if (num < 0)
			return "0";
		else if (num <= 5)
			return "5";	// Still shows low coverage
		else if (num > 100)
			str = "100";
		return str;
	};
	Mark.pipes.coverageDisplay = function(str)
	{
		var num = parseFloat(str);
		return num < 0 ? "" : num + "% coverage";
	};
	Mark.pipes.coverageReportName = function(str)
	{
		return str.replace(/\//g, "-");
	};
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
