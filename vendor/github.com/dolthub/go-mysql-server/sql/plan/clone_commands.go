// Copyright 2022 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package plan

// DynamicPrivilege_CloneAdmin is the dynamic privilege required to execute clone commands.
// https://dev.mysql.com/doc/refman/8.0/en/privileges-provided.html#priv_clone-admin
const DynamicPrivilege_CloneAdmin = "clone_admin"
