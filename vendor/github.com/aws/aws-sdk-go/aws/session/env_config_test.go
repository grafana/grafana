package session

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/stretchr/testify/assert"
)

func TestLoadEnvConfig_Creds(t *testing.T) {
	env := stashEnv()
	defer popEnv(env)

	cases := []struct {
		Env map[string]string
		Val credentials.Value
	}{
		{
			Env: map[string]string{
				"AWS_ACCESS_KEY": "AKID",
			},
			Val: credentials.Value{},
		},
		{
			Env: map[string]string{
				"AWS_ACCESS_KEY_ID": "AKID",
			},
			Val: credentials.Value{},
		},
		{
			Env: map[string]string{
				"AWS_SECRET_KEY": "SECRET",
			},
			Val: credentials.Value{},
		},
		{
			Env: map[string]string{
				"AWS_SECRET_ACCESS_KEY": "SECRET",
			},
			Val: credentials.Value{},
		},
		{
			Env: map[string]string{
				"AWS_ACCESS_KEY_ID":     "AKID",
				"AWS_SECRET_ACCESS_KEY": "SECRET",
			},
			Val: credentials.Value{
				AccessKeyID: "AKID", SecretAccessKey: "SECRET",
				ProviderName: "EnvConfigCredentials",
			},
		},
		{
			Env: map[string]string{
				"AWS_ACCESS_KEY": "AKID",
				"AWS_SECRET_KEY": "SECRET",
			},
			Val: credentials.Value{
				AccessKeyID: "AKID", SecretAccessKey: "SECRET",
				ProviderName: "EnvConfigCredentials",
			},
		},
		{
			Env: map[string]string{
				"AWS_ACCESS_KEY":    "AKID",
				"AWS_SECRET_KEY":    "SECRET",
				"AWS_SESSION_TOKEN": "TOKEN",
			},
			Val: credentials.Value{
				AccessKeyID: "AKID", SecretAccessKey: "SECRET", SessionToken: "TOKEN",
				ProviderName: "EnvConfigCredentials",
			},
		},
	}

	for _, c := range cases {
		os.Clearenv()

		for k, v := range c.Env {
			os.Setenv(k, v)
		}

		cfg := loadEnvConfig()
		assert.Equal(t, c.Val, cfg.Creds)
	}
}

func TestLoadEnvConfig(t *testing.T) {
	env := stashEnv()
	defer popEnv(env)

	cases := []struct {
		Env                 map[string]string
		Region, Profile     string
		UseSharedConfigCall bool
	}{
		{
			Env: map[string]string{
				"AWS_REGION":  "region",
				"AWS_PROFILE": "profile",
			},
			Region: "region", Profile: "profile",
		},
		{
			Env: map[string]string{
				"AWS_REGION":          "region",
				"AWS_DEFAULT_REGION":  "default_region",
				"AWS_PROFILE":         "profile",
				"AWS_DEFAULT_PROFILE": "default_profile",
			},
			Region: "region", Profile: "profile",
		},
		{
			Env: map[string]string{
				"AWS_REGION":          "region",
				"AWS_DEFAULT_REGION":  "default_region",
				"AWS_PROFILE":         "profile",
				"AWS_DEFAULT_PROFILE": "default_profile",
				"AWS_SDK_LOAD_CONFIG": "1",
			},
			Region: "region", Profile: "profile",
		},
		{
			Env: map[string]string{
				"AWS_DEFAULT_REGION":  "default_region",
				"AWS_DEFAULT_PROFILE": "default_profile",
			},
		},
		{
			Env: map[string]string{
				"AWS_DEFAULT_REGION":  "default_region",
				"AWS_DEFAULT_PROFILE": "default_profile",
				"AWS_SDK_LOAD_CONFIG": "1",
			},
			Region: "default_region", Profile: "default_profile",
		},
		{
			Env: map[string]string{
				"AWS_REGION":  "region",
				"AWS_PROFILE": "profile",
			},
			Region: "region", Profile: "profile",
			UseSharedConfigCall: true,
		},
		{
			Env: map[string]string{
				"AWS_REGION":          "region",
				"AWS_DEFAULT_REGION":  "default_region",
				"AWS_PROFILE":         "profile",
				"AWS_DEFAULT_PROFILE": "default_profile",
			},
			Region: "region", Profile: "profile",
			UseSharedConfigCall: true,
		},
		{
			Env: map[string]string{
				"AWS_REGION":          "region",
				"AWS_DEFAULT_REGION":  "default_region",
				"AWS_PROFILE":         "profile",
				"AWS_DEFAULT_PROFILE": "default_profile",
				"AWS_SDK_LOAD_CONFIG": "1",
			},
			Region: "region", Profile: "profile",
			UseSharedConfigCall: true,
		},
		{
			Env: map[string]string{
				"AWS_DEFAULT_REGION":  "default_region",
				"AWS_DEFAULT_PROFILE": "default_profile",
			},
			Region: "default_region", Profile: "default_profile",
			UseSharedConfigCall: true,
		},
		{
			Env: map[string]string{
				"AWS_DEFAULT_REGION":  "default_region",
				"AWS_DEFAULT_PROFILE": "default_profile",
				"AWS_SDK_LOAD_CONFIG": "1",
			},
			Region: "default_region", Profile: "default_profile",
			UseSharedConfigCall: true,
		},
	}

	for _, c := range cases {
		os.Clearenv()

		for k, v := range c.Env {
			os.Setenv(k, v)
		}

		var cfg envConfig
		if c.UseSharedConfigCall {
			cfg = loadSharedEnvConfig()
		} else {
			cfg = loadEnvConfig()
		}

		assert.Equal(t, c.Region, cfg.Region)
		assert.Equal(t, c.Profile, cfg.Profile)
	}
}

func TestSharedCredsFilename(t *testing.T) {
	env := stashEnv()
	defer popEnv(env)

	os.Setenv("USERPROFILE", "profile_dir")
	expect := filepath.Join("profile_dir", ".aws", "credentials")
	name := sharedCredentialsFilename()
	assert.Equal(t, expect, name)

	os.Setenv("HOME", "home_dir")
	expect = filepath.Join("home_dir", ".aws", "credentials")
	name = sharedCredentialsFilename()
	assert.Equal(t, expect, name)

	expect = filepath.Join("path/to/credentials/file")
	os.Setenv("AWS_SHARED_CREDENTIALS_FILE", expect)
	name = sharedCredentialsFilename()
	assert.Equal(t, expect, name)
}

func TestSharedConfigFilename(t *testing.T) {
	env := stashEnv()
	defer popEnv(env)

	os.Setenv("USERPROFILE", "profile_dir")
	expect := filepath.Join("profile_dir", ".aws", "config")
	name := sharedConfigFilename()
	assert.Equal(t, expect, name)

	os.Setenv("HOME", "home_dir")
	expect = filepath.Join("home_dir", ".aws", "config")
	name = sharedConfigFilename()
	assert.Equal(t, expect, name)

	expect = filepath.Join("path/to/config/file")
	os.Setenv("AWS_CONFIG_FILE", expect)
	name = sharedConfigFilename()
	assert.Equal(t, expect, name)
}

func TestSetEnvValue(t *testing.T) {
	env := stashEnv()
	defer popEnv(env)

	os.Setenv("empty_key", "")
	os.Setenv("second_key", "2")
	os.Setenv("third_key", "3")

	var dst string
	setFromEnvVal(&dst, []string{
		"empty_key", "first_key", "second_key", "third_key",
	})

	assert.Equal(t, "2", dst)
}

func stashEnv() []string {
	env := os.Environ()
	os.Clearenv()

	return env
}

func popEnv(env []string) {
	os.Clearenv()

	for _, e := range env {
		p := strings.SplitN(e, "=", 2)
		os.Setenv(p[0], p[1])
	}
}
