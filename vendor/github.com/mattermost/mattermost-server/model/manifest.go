// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v2"
)

const (
	PLUGIN_CONFIG_TYPE_TEXT      = "text"
	PLUGIN_CONFIG_TYPE_BOOL      = "bool"
	PLUGIN_CONFIG_TYPE_RADIO     = "radio"
	PLUGIN_CONFIG_TYPE_DROPDOWN  = "dropdown"
	PLUGIN_CONFIG_TYPE_GENERATED = "generated"
	PLUGIN_CONFIG_TYPE_USERNAME  = "username"
)

type PluginOption struct {
	// The display name for the option.
	DisplayName string `json:"display_name" yaml:"display_name"`

	// The string value for the option.
	Value string `json:"value" yaml:"value"`
}

type PluginSetting struct {
	// The key that the setting will be assigned to in the configuration file.
	Key string `json:"key" yaml:"key"`

	// The display name for the setting.
	DisplayName string `json:"display_name" yaml:"display_name"`

	// The type of the setting.
	//
	// "bool" will result in a boolean true or false setting.
	//
	// "dropdown" will result in a string setting that allows the user to select from a list of
	// pre-defined options.
	//
	// "generated" will result in a string setting that is set to a random, cryptographically secure
	// string.
	//
	// "radio" will result in a string setting that allows the user to select from a short selection
	// of pre-defined options.
	//
	// "text" will result in a string setting that can be typed in manually.
	//
	// "username" will result in a text setting that will autocomplete to a username.
	Type string `json:"type" yaml:"type"`

	// The help text to display to the user.
	HelpText string `json:"help_text" yaml:"help_text"`

	// The help text to display alongside the "Regenerate" button for settings of the "generated" type.
	RegenerateHelpText string `json:"regenerate_help_text,omitempty" yaml:"regenerate_help_text,omitempty"`

	// The placeholder to display for "text", "generated" and "username" types when blank.
	Placeholder string `json:"placeholder" yaml:"placeholder"`

	// The default value of the setting.
	Default interface{} `json:"default" yaml:"default"`

	// For "radio" or "dropdown" settings, this is the list of pre-defined options that the user can choose
	// from.
	Options []*PluginOption `json:"options,omitempty" yaml:"options,omitempty"`
}

type PluginSettingsSchema struct {
	// Optional text to display above the settings.
	Header string `json:"header" yaml:"header"`

	// Optional text to display below the settings.
	Footer string `json:"footer" yaml:"footer"`

	// A list of setting definitions.
	Settings []*PluginSetting `json:"settings" yaml:"settings"`
}

// The plugin manifest defines the metadata required to load and present your plugin. The manifest
// file should be named plugin.json or plugin.yaml and placed in the top of your
// plugin bundle.
//
// Example plugin.yaml:
//
//     id: com.mycompany.myplugin
//     name: My Plugin
//     description: This is my plugin. It does stuff.
//     backend:
//         executable: myplugin
//     settings_schema:
//         settings:
//             - key: enable_extra_thing
//               type: bool
//               display_name: Enable Extra Thing
//               help_text: When true, an extra thing will be enabled!
//               default: false
type Manifest struct {
	// The id is a globally unique identifier that represents your plugin. Ids are limited
	// to 190 characters. Reverse-DNS notation using a name you control is a good option.
	// For example, "com.mycompany.myplugin".
	Id string `json:"id" yaml:"id"`

	// The name to be displayed for the plugin.
	Name string `json:"name,omitempty" yaml:"name,omitempty"`

	// A description of what your plugin is and does.
	Description string `json:"description,omitempty" yaml:"description,omitempty"`

	// A version number for your plugin. Semantic versioning is recommended: http://semver.org
	Version string `json:"version" yaml:"version"`

	// If your plugin extends the server, you'll need define backend.
	Backend *ManifestBackend `json:"backend,omitempty" yaml:"backend,omitempty"`

	// If your plugin extends the web app, you'll need to define webapp.
	Webapp *ManifestWebapp `json:"webapp,omitempty" yaml:"webapp,omitempty"`

	// To allow administrators to configure your plugin via the Mattermost system console, you can
	// provide your settings schema.
	SettingsSchema *PluginSettingsSchema `json:"settings_schema,omitempty" yaml:"settings_schema,omitempty"`
}

type ManifestBackend struct {
	// The path to your executable binary. This should be relative to the root of your bundle and the
	// location of the manifest file.
	//
	// On Windows, this file must have a ".exe" extension.
	Executable string `json:"executable" yaml:"executable"`
}

type ManifestWebapp struct {
	// The path to your webapp bundle. This should be relative to the root of your bundle and the
	// location of the manifest file.
	BundlePath string `json:"bundle_path" yaml:"bundle_path"`
}

func (m *Manifest) ToJson() string {
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ManifestListToJson(m []*Manifest) string {
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ManifestFromJson(data io.Reader) *Manifest {
	decoder := json.NewDecoder(data)
	var m Manifest
	err := decoder.Decode(&m)
	if err == nil {
		return &m
	} else {
		return nil
	}
}

func ManifestListFromJson(data io.Reader) []*Manifest {
	decoder := json.NewDecoder(data)
	var manifests []*Manifest
	err := decoder.Decode(&manifests)
	if err == nil {
		return manifests
	} else {
		return nil
	}
}

func (m *Manifest) HasClient() bool {
	return m.Webapp != nil
}

func (m *Manifest) ClientManifest() *Manifest {
	cm := new(Manifest)
	*cm = *m
	cm.Name = ""
	cm.Description = ""
	cm.Backend = nil
	return cm
}

// FindManifest will find and parse the manifest in a given directory.
//
// In all cases other than a does-not-exist error, path is set to the path of the manifest file that was
// found.
//
// Manifests are JSON or YAML files named plugin.json, plugin.yaml, or plugin.yml.
func FindManifest(dir string) (manifest *Manifest, path string, err error) {
	for _, name := range []string{"plugin.yml", "plugin.yaml"} {
		path = filepath.Join(dir, name)
		f, ferr := os.Open(path)
		if ferr != nil {
			if !os.IsNotExist(ferr) {
				err = ferr
				return
			}
			continue
		}
		b, ioerr := ioutil.ReadAll(f)
		f.Close()
		if ioerr != nil {
			err = ioerr
			return
		}
		var parsed Manifest
		err = yaml.Unmarshal(b, &parsed)
		if err != nil {
			return
		}
		manifest = &parsed
		return
	}

	path = filepath.Join(dir, "plugin.json")
	f, ferr := os.Open(path)
	if ferr != nil {
		if os.IsNotExist(ferr) {
			path = ""
		}
		err = ferr
		return
	}
	defer f.Close()
	var parsed Manifest
	err = json.NewDecoder(f).Decode(&parsed)
	if err != nil {
		return
	}
	manifest = &parsed
	return
}
