package chromedp

import (
	"context"
	"errors"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/page"
)

// Navigate navigates the current frame.
func Navigate(urlstr string) Action {
	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		th, ok := h.(*TargetHandler)
		if !ok {
			return ErrInvalidHandler
		}

		frameID, _, _, err := page.Navigate(urlstr).Do(ctxt, th)
		if err != nil {
			return err
		}

		return th.SetActive(ctxt, frameID)
	})
}

// NavigationEntries is an action to retrieve the page's navigation history
// entries.
func NavigationEntries(currentIndex *int64, entries *[]*page.NavigationEntry) Action {
	if currentIndex == nil || entries == nil {
		panic("currentIndex and entries cannot be nil")
	}

	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		var err error
		*currentIndex, *entries, err = page.GetNavigationHistory().Do(ctxt, h)
		return err
	})
}

// NavigateToHistoryEntry is an action to navigate to the specified navigation
// entry.
func NavigateToHistoryEntry(entryID int64) Action {
	return page.NavigateToHistoryEntry(entryID)
}

// NavigateBack navigates the current frame backwards in its history.
func NavigateBack() Action {
	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		cur, entries, err := page.GetNavigationHistory().Do(ctxt, h)
		if err != nil {
			return err
		}

		if cur <= 0 || cur > int64(len(entries)-1) {
			return errors.New("invalid navigation entry")
		}

		return page.NavigateToHistoryEntry(entries[cur-1].ID).Do(ctxt, h)
	})
}

// NavigateForward navigates the current frame forwards in its history.
func NavigateForward() Action {
	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		cur, entries, err := page.GetNavigationHistory().Do(ctxt, h)
		if err != nil {
			return err
		}

		if cur < 0 || cur >= int64(len(entries)-1) {
			return errors.New("invalid navigation entry")
		}

		return page.NavigateToHistoryEntry(entries[cur+1].ID).Do(ctxt, h)
	})
}

// Stop stops all navigation and pending resource retrieval.
func Stop() Action {
	return page.StopLoading()
}

// Reload reloads the current page.
func Reload() Action {
	return page.Reload()
}

// CaptureScreenshot captures takes a screenshot of the current viewport.
//
// Note: this an alias for page.CaptureScreenshot.
func CaptureScreenshot(res *[]byte) Action {
	if res == nil {
		panic("res cannot be nil")
	}

	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		var err error
		*res, err = page.CaptureScreenshot().Do(ctxt, h)
		return err
	})
}

// AddOnLoadScript adds a script to evaluate on page load.
/*func AddOnLoadScript(source string, id *page.ScriptIdentifier) Action {
	if id == nil {
		panic("id cannot be nil")
	}

	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		var err error
		*id, err = page.AddScriptToEvaluateOnLoad(source).Do(ctxt, h)
		return err
	})
}

// RemoveOnLoadScript removes a script to evaluate on page load.
func RemoveOnLoadScript(id page.ScriptIdentifier) Action {
	return page.RemoveScriptToEvaluateOnLoad(id)
}*/

// Location retrieves the document location.
func Location(urlstr *string) Action {
	if urlstr == nil {
		panic("urlstr cannot be nil")
	}

	return EvaluateAsDevTools(`document.location.toString()`, urlstr)
}

// Title retrieves the document title.
func Title(title *string) Action {
	if title == nil {
		panic("title cannot be nil")
	}

	return EvaluateAsDevTools(`document.title`, title)
}
