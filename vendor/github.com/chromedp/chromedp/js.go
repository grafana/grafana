package chromedp

const (
	// textJS is a javascript snippet that returns the concatenated textContent
	// of all visible (ie, offsetParent !== null) children.
	textJS = `(function(a) {
		var s = '';
		for (var i = 0; i < a.length; i++) {
			if (a[i].offsetParent !== null) {
				s += a[i].textContent;
			}
		}
		return s;
	})($x('%s/node()'))`

	// blurJS is a javscript snippet that blurs the specified element.
	blurJS = `(function(a) {
		a[0].blur();
		return true;
	})($x('%s'))`

	// scrollJS is a javascript snippet that scrolls the window to the
	// specified x, y coordinates and then returns the actual window x/y after
	// execution.
	scrollJS = `(function(x, y) {
		window.scrollTo(x, y);
		return [window.scrollX, window.scrollY];
	})(%d, %d)`

	// scrollIntoViewJS is a javascript snippet that scrolls the specified node
	// into the window's viewport (if needed), returning the actual window x/y
	// after execution.
	scrollIntoViewJS = `(function(a) {
		a[0].scrollIntoViewIfNeeded(true);
		return [window.scrollX, window.scrollY];
	})($x('%s'))`

	// submitJS is a javascript snippet that will call the containing form's
	// submit function, returning true or false if the call was successful.
	submitJS = `(function(a) {
		if (a[0].nodeName === 'FORM') {
			a[0].submit();
			return true;
		} else if (a[0].form !== null) {
			a[0].form.submit();
			return true;
		}
		return false;
	})($x('%s'))`

	// resetJS is a javascript snippet that will call the containing form's
	// reset function, returning true or false if the call was successful.
	resetJS = `(function(a) {
		if (a[0].nodeName === 'FORM') {
			a[0].reset();
			return true;
		} else if (a[0].form !== null) {
			a[0].form.reset();
			return true;
		}
		return false;
	})($x('%s'))`

	// attributeJS is a javascript snippet that returns the attribute of a specified
	// node.
	attributeJS = `(function(a, n) {
		return a[0][n];
	})($x('%s'), '%s')`

	// setAttributeJS is a javascript snippet that sets the value of the specified
	// node, and returns the value.
	setAttributeJS = `(function(a, n, v) {
		return a[0][n] = v;
	})($x('%s'), '%s', '%s')`

	// visibleJS is a javascript snippet that returns true or false depending
	// on if the specified node's offsetParent is not null.
	visibleJS = `(function(a) {
		return a[0].offsetParent !== null;
	})($x('%s'))`
)
