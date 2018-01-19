var convey = {

	//	*** Don't edit in here unless you're brave ***

	statuses: {				// contains some constants related to overall test status
		pass: { class: 'ok', text: "Pass" },	// class name must also be that in the favicon file name
		fail: { class: 'fail', text: "Fail" },
		panic: { class: 'panic', text: "Panic" },
		buildfail: { class: 'buildfail', text: "Build Failure" }
	},
	frameCounter: 0,		// gives each frame a unique ID
	maxHistory: 20,			// how many tests to keep in the history
	notif: undefined,		// the notification currently being displayed
	notifTimer: undefined,	// the timer that clears the notifications automatically
	poller: new Poller(),	// the server poller
	status: "",				// what the _server_ is currently doing (not overall test results)
	overallClass: "",		// class name of the "overall" status banner
	theme: "",				// theme currently being used
	packageStates: {},		// packages manually collapsed or expanded during this page's lifetime
	uiEffects: true,		// whether visual effects are enabled
	framesOnSamePath: 0,	// number of consecutive frames on this same watch path
	layout: {
		selClass: "sel",	// CSS class when an element is "selected"
		header: undefined,	// container element of the header area (overall, controls)
		frame: undefined,	// container element of the main body area (above footer)
		footer: undefined	// container element of the footer (stuck to bottom)
	},
	history: [],			// complete history of states (test results and aggregated data), including the current one
	moments: {},			// elements that display time relative to the current time, keyed by ID, with the moment() as a value
	intervals: {},			// ntervals that execute periodically
	intervalFuncs: {		// functions executed by each interval in convey.intervals
		time: function()
		{
			var t = new Date();
			var h = zerofill(t.getHours(), 2);
			var m = zerofill(t.getMinutes(), 2);
			var s = zerofill(t.getSeconds(), 2);
			$('#time').text(h + ":" + m + ":" + s);
		},
		momentjs: function()
		{
			for (var id in convey.moments)
				$('#'+id).html(convey.moments[id].fromNow());
		}
	}
};
