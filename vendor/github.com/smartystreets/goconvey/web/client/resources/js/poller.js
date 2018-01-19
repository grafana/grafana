function Poller(config)
{
	// CONFIGURABLE
	var endpoints = {
		up: "/status/poll",		// url to poll when the server is up
		down: "/status"			// url to poll at regular intervals when the server is down
	};
	var timeout =  60000 * 2;	// how many ms between polling attempts
	var intervalMs = 1000;		// ms between polls when the server is down

	// INTERNAL STATE
	var up = true;				// whether or not we can connect to the server
	var req;					// the pending ajax request
	var downPoller;				// the setInterval for polling when the server is down
	var self = this;

	if (typeof config === 'object')
	{
		if (typeof config.endpoints === 'object')
		{
			endpoints.up = config.endpoints.up;
			endpoints.down = config.endpoints.down;
		}
		if (config.timeout)
			timeout = config.timeout;
		if (config.interval)
			intervalMs = config.interval;
	}

	$(self).on('pollstart', function(event, data) {
		log("Started poller");
	}).on('pollstop', function(event, data) {
		log("Stopped poller");
	});


	this.start = function()
	{
		if (req)
			return false;
		doPoll();
		$(self).trigger('pollstart', {url: endpoints.up, timeout: timeout});
		return true;
	};

	this.stop = function()
	{
		if (!req)
			return false;
		req.abort();
		req = undefined;
		stopped = true;
		stopDownPoller();
		$(self).trigger('pollstop', {});
		return true;
	};

	this.setTimeout = function(tmout)
	{
		timeout = tmout;	// takes effect at next poll
	};

	this.isUp = function()
	{
		return up;
	};

	function doPoll()
	{
		req = $.ajax({
			url: endpoints.up + "?timeout=" + timeout,
			timeout: timeout
		}).done(pollSuccess).fail(pollFailed);
	}

	function pollSuccess(data, message, jqxhr)
	{
		stopDownPoller();
		doPoll();

		var wasUp = up;
		up = true;
		status = data;

		var arg = {
			status: status,
			data: data,
			jqxhr: jqxhr
		};

		if (!wasUp)
			$(convey.poller).trigger('serverstarting', arg);
		else
			$(self).trigger('pollsuccess', arg);
	}

	function pollFailed(jqxhr, message, exception)
	{
		if (message === "timeout")
		{
			log("Poller timeout; re-polling...", req);
			doPoll();	// in our case, timeout actually means no activity; poll again
			return;
		}

		up = false;

		downPoller = setInterval(function()
		{
			// If the server is still down, do a ping to see
			// if it's up; pollSuccess() will do the rest.
			if (!up)
				$.get(endpoints.down).done(pollSuccess);
		}, intervalMs);

		$(self).trigger('pollfail', {
			exception: exception,
			message: message,
			jqxhr: jqxhr
		});
	}

	function stopDownPoller()
	{
		if (!downPoller)
			return;
		clearInterval(downPoller);
		downPoller = undefined;
	}
}
