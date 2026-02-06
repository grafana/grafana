package option

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/mitchellh/go-homedir"
	"github.com/mithrandie/csvq/lib/file"
	"github.com/mithrandie/go-text/color"
)

const (
	XDGConfigHomeEnvName   = "XDG_CONFIG_HOME"
	DefaultXDGConfigDir    = ".config"
	CSVQConfigDir          = "csvq"
	EnvFileName            = "csvq_env.json"
	PreloadCommandFileName = "csvqrc"

	HiddenPrefix = '.'
)

type Environment struct {
	DatetimeFormat       []string            `json:"datetime_format"`
	Timezone             *string             `json:"timezone"`
	AnsiQuotes           *bool               `json:"ansi_quotes"`
	InteractiveShell     InteractiveShell    `json:"interactive_shell"`
	EnvironmentVariables map[string]string   `json:"environment_variables"`
	Palette              color.PaletteConfig `json:"palette"`
}

func NewEnvironment(ctx context.Context, defaultWaitTimeout time.Duration, retryDelay time.Duration) (*Environment, error) {
	env := &Environment{}
	if err := json.Unmarshal([]byte(DefaultEnvJson), env); err != nil {
		err = errors.New(fmt.Sprintf("`json syntax error: %s", err.Error()))
		return nil, err
	}

	err := env.Load(ctx, defaultWaitTimeout, retryDelay)
	return env, err
}

func (e *Environment) Merge(e2 *Environment) {
	for _, f := range e2.DatetimeFormat {
		e.DatetimeFormat = AppendStrIfNotExist(e.DatetimeFormat, f)
	}

	if e2.Timezone != nil {
		e.Timezone = e2.Timezone
	}

	if e2.AnsiQuotes != nil {
		e.AnsiQuotes = e2.AnsiQuotes
	}

	if 0 < len(e2.InteractiveShell.HistoryFile) {
		e.InteractiveShell.HistoryFile = e2.InteractiveShell.HistoryFile
	}

	if e2.InteractiveShell.HistoryLimit != nil {
		e.InteractiveShell.HistoryLimit = e2.InteractiveShell.HistoryLimit
	}

	if 0 < len(e2.InteractiveShell.Prompt) {
		e.InteractiveShell.Prompt = e2.InteractiveShell.Prompt
	}

	if 0 < len(e2.InteractiveShell.ContinuousPrompt) {
		e.InteractiveShell.ContinuousPrompt = e2.InteractiveShell.ContinuousPrompt
	}

	if e2.InteractiveShell.Completion != nil {
		e.InteractiveShell.Completion = e2.InteractiveShell.Completion
	}

	if e2.InteractiveShell.KillWholeLine != nil {
		e.InteractiveShell.KillWholeLine = e2.InteractiveShell.KillWholeLine
	}

	if e2.InteractiveShell.ViMode != nil {
		e.InteractiveShell.ViMode = e2.InteractiveShell.ViMode
	}

	for k, v := range e2.EnvironmentVariables {
		e.EnvironmentVariables[k] = v
	}

	for k, v := range e2.Palette.Effectors {
		e.Palette.Effectors[k] = v
	}
}

type InteractiveShell struct {
	HistoryFile      string `json:"history_file"`
	HistoryLimit     *int   `json:"history_limit"`
	Prompt           string `json:"prompt"`
	ContinuousPrompt string `json:"continuous_prompt"`
	Completion       *bool  `json:"completion"`
	KillWholeLine    *bool  `json:"kill_whole_line"`
	ViMode           *bool  `json:"vi_mode"`
}

func (e *Environment) Load(ctx context.Context, defaultWaitTimeout time.Duration, retryDelay time.Duration) (err error) {
	container := file.NewContainer()
	defer func() {
		if e := container.CloseAll(); e != nil {
			if err == nil {
				err = e
			} else {
				err = errors.New(err.Error() + "\n" + e.Error())
			}
		}
	}()

	files := GetSpecialFilePath(EnvFileName)
	for _, fpath := range files {
		if !file.Exists(fpath) {
			continue
		}

		var h *file.Handler
		var buf []byte

		h, err = container.CreateHandlerWithoutLock(ctx, fpath, defaultWaitTimeout, retryDelay)
		if err != nil {
			return
		}

		buf, err = io.ReadAll(h.File())
		if err != nil {
			err = errors.New(fmt.Sprintf("failed to load %q: %s", fpath, err.Error()))
			return
		}
		buf = bytes.TrimSuffix(buf, []byte{0x00})
		userDefinedEnv := &Environment{}
		if err = json.Unmarshal(buf, userDefinedEnv); err != nil {
			err = errors.New(fmt.Sprintf("failed to load %q: %s", fpath, err.Error()))
			return
		}

		e.Merge(userDefinedEnv)
	}

	for k, v := range e.EnvironmentVariables {
		if e := os.Setenv(k, v); e != nil {
			if err == nil {
				err = e
			} else {
				err = errors.New(err.Error() + "\n" + e.Error())
			}
		}
	}

	return
}

func GetSpecialFilePath(filename string) []string {
	files := make([]string, 0, 4)
	files = AppendStrIfNotExist(files, GetConfigDirFilePath(filename))
	files = AppendStrIfNotExist(files, GetHomeDirFilePath(filename))
	files = AppendStrIfNotExist(files, GetCSVQConfigDirFilePath(filename))
	files = AppendStrIfNotExist(files, GetCurrentDirFilePath(filename))
	return files
}

func GetHomeDirFilePath(filename string) string {
	home, err := homedir.Dir()
	if err != nil {
		return filename
	}

	if 0 < len(filename) && filename[0] != HiddenPrefix {
		filename = string(HiddenPrefix) + filename
	}

	return filepath.Join(home, filename)
}

func GetCSVQConfigDirFilePath(filename string) string {
	home, err := homedir.Dir()
	if err != nil {
		return filename
	}

	return filepath.Join(home, string(HiddenPrefix)+CSVQConfigDir, filename)
}

func GetConfigDirFilePath(filename string) string {
	configHome := os.Getenv(XDGConfigHomeEnvName)
	if len(configHome) < 1 {
		home, err := homedir.Dir()
		if err != nil {
			return filename
		}
		configHome = filepath.Join(home, DefaultXDGConfigDir)
	}

	return filepath.Join(configHome, CSVQConfigDir, filename)
}

func GetCurrentDirFilePath(filename string) string {
	if !filepath.IsAbs(filename) {
		if abs, err := filepath.Abs(filename); err == nil {
			filename = abs
		}
	}
	return filename
}
