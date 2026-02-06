// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

func (c *Sys) Rotate() error {
	return c.RotateWithContext(context.Background())
}

func (c *Sys) RotateWithContext(ctx context.Context) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPost, "/v1/sys/rotate")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err == nil {
		defer resp.Body.Close()
	}
	return err
}

func (c *Sys) KeyStatus() (*KeyStatus, error) {
	return c.KeyStatusWithContext(context.Background())
}

func (c *Sys) KeyStatusWithContext(ctx context.Context) (*KeyStatus, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, "/v1/sys/key-status")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	var result KeyStatus

	termRaw, ok := secret.Data["term"]
	if !ok {
		return nil, errors.New("term not found in response")
	}
	term, ok := termRaw.(json.Number)
	if !ok {
		return nil, errors.New("could not convert term to a number")
	}
	term64, err := term.Int64()
	if err != nil {
		return nil, err
	}
	result.Term = int(term64)

	installTimeRaw, ok := secret.Data["install_time"]
	if !ok {
		return nil, errors.New("install_time not found in response")
	}
	installTimeStr, ok := installTimeRaw.(string)
	if !ok {
		return nil, errors.New("could not convert install_time to a string")
	}
	installTime, err := time.Parse(time.RFC3339Nano, installTimeStr)
	if err != nil {
		return nil, err
	}
	result.InstallTime = installTime

	encryptionsRaw, ok := secret.Data["encryptions"]
	if ok {
		encryptions, ok := encryptionsRaw.(json.Number)
		if !ok {
			return nil, errors.New("could not convert encryptions to a number")
		}
		encryptions64, err := encryptions.Int64()
		if err != nil {
			return nil, err
		}
		result.Encryptions = int(encryptions64)
	}

	return &result, err
}

type KeyStatus struct {
	Term        int       `json:"term"`
	InstallTime time.Time `json:"install_time"`
	Encryptions int       `json:"encryptions"`
}
