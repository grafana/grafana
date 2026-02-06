// Copyright 2021 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package impersonate is used to impersonate Google Credentials.
//
// # Required IAM roles
//
// In order to impersonate a service account the base service account must have
// the Service Account Token Creator role, roles/iam.serviceAccountTokenCreator,
// on the service account being impersonated. See
// https://cloud.google.com/iam/docs/understanding-service-accounts.
//
// Optionally, delegates can be used during impersonation if the base service
// account lacks the token creator role on the target. When using delegates,
// each service account must be granted roles/iam.serviceAccountTokenCreator
// on the next service account in the delgation chain.
//
// For example, if a base service account of SA1 is trying to impersonate target
// service account SA2 while using delegate service accounts DSA1 and DSA2,
// the following must be true:
//
//  1. Base service account SA1 has roles/iam.serviceAccountTokenCreator on
//     DSA1.
//  2. DSA1 has roles/iam.serviceAccountTokenCreator on DSA2.
//  3. DSA2 has roles/iam.serviceAccountTokenCreator on target SA2.
//
// If the base credential is an authorized user and not a service account, or if
// the option WithQuotaProject is set, the target service account must have a
// role that grants the serviceusage.services.use permission such as
// roles/serviceusage.serviceUsageConsumer.
package impersonate
