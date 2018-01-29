// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"errors"
	"io/ioutil"

	"github.com/spf13/cobra"
)

var licenseCmd = &cobra.Command{
	Use:   "license",
	Short: "Licensing commands",
}

var uploadLicenseCmd = &cobra.Command{
	Use:     "upload [license]",
	Short:   "Upload a license.",
	Long:    "Upload a license. Replaces current license.",
	Example: "  license upload /path/to/license/mylicensefile.mattermost-license",
	RunE:    uploadLicenseCmdF,
}

func init() {
	licenseCmd.AddCommand(uploadLicenseCmd)
}

func uploadLicenseCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if len(args) != 1 {
		return errors.New("Enter one license file to upload")
	}

	var fileBytes []byte
	if fileBytes, err = ioutil.ReadFile(args[0]); err != nil {
		return err
	}

	if _, err := a.SaveLicense(fileBytes); err != nil {
		return err
	}

	CommandPrettyPrintln("Uploaded license file")

	return nil
}
