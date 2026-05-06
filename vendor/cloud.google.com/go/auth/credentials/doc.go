// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package credentials provides support for making OAuth2 authorized and
// authenticated HTTP requests to Google APIs. It supports the Web server flow,
// client-side credentials, service accounts, Google Compute Engine service
// accounts, Google App Engine service accounts and workload identity federation
// from non-Google cloud platforms.
//
// A brief overview of the package follows. For more information, please read
// https://developers.google.com/accounts/docs/OAuth2
// and
// https://developers.google.com/accounts/docs/application-default-credentials.
// For more information on using workload identity federation, refer to
// https://cloud.google.com/iam/docs/how-to#using-workload-identity-federation.
//
// # Credentials
//
// The [cloud.google.com/go/auth.Credentials] type represents Google
// credentials, including Application Default Credentials.
//
// Use [DetectDefault] to obtain Application Default Credentials.
//
// Application Default Credentials support workload identity federation to
// access Google Cloud resources from non-Google Cloud platforms including Amazon
// Web Services (AWS), Microsoft Azure or any identity provider that supports
// OpenID Connect (OIDC). Workload identity federation is recommended for
// non-Google Cloud environments as it avoids the need to download, manage, and
// store service account private keys locally.
//
// # Workforce Identity Federation
//
// For more information on this feature see [cloud.google.com/go/auth/credentials/externalaccount].
package credentials
