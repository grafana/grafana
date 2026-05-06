// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
)

// Monitor returns a channel that outputs strings containing the log messages
// coming from the server.
func (c *Sys) Monitor(ctx context.Context, logLevel string, logFormat string) (chan string, error) {
	r := c.c.NewRequest(http.MethodGet, "/v1/sys/monitor")

	if logLevel == "" {
		r.Params.Add("log_level", "info")
	} else {
		r.Params.Add("log_level", logLevel)
	}

	if logFormat == "" {
		r.Params.Add("log_format", "standard")
	} else {
		r.Params.Add("log_format", logFormat)
	}

	resp, err := c.c.RawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}

	logCh := make(chan string, 64)

	go func() {
		scanner := bufio.NewScanner(resp.Body)
		droppedCount := 0

		defer close(logCh)
		defer resp.Body.Close()

		for {
			if ctx.Err() != nil {
				return
			}

			if !scanner.Scan() {
				return
			}

			logMessage := scanner.Text()

			if droppedCount > 0 {
				select {
				case logCh <- fmt.Sprintf("Monitor dropped %d logs during monitor request\n", droppedCount):
					droppedCount = 0
				default:
					droppedCount++
					continue
				}
			}

			select {
			case logCh <- logMessage:
			default:
				droppedCount++
			}
		}
	}()

	return logCh, nil
}
