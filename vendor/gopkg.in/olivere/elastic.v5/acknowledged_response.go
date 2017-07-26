// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// AcknowledgedResponse is returned from various APIs. It simply indicates
// whether the operation is ack'd or not.
type AcknowledgedResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
