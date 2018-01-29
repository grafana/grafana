// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type Permission struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Role struct {
	Id          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

var PERMISSION_INVITE_USER *Permission
var PERMISSION_ADD_USER_TO_TEAM *Permission
var PERMISSION_USE_SLASH_COMMANDS *Permission
var PERMISSION_MANAGE_SLASH_COMMANDS *Permission
var PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS *Permission
var PERMISSION_CREATE_PUBLIC_CHANNEL *Permission
var PERMISSION_CREATE_PRIVATE_CHANNEL *Permission
var PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS *Permission
var PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS *Permission
var PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE *Permission
var PERMISSION_MANAGE_ROLES *Permission
var PERMISSION_MANAGE_TEAM_ROLES *Permission
var PERMISSION_MANAGE_CHANNEL_ROLES *Permission
var PERMISSION_CREATE_DIRECT_CHANNEL *Permission
var PERMISSION_CREATE_GROUP_CHANNEL *Permission
var PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES *Permission
var PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES *Permission
var PERMISSION_LIST_TEAM_CHANNELS *Permission
var PERMISSION_JOIN_PUBLIC_CHANNELS *Permission
var PERMISSION_DELETE_PUBLIC_CHANNEL *Permission
var PERMISSION_DELETE_PRIVATE_CHANNEL *Permission
var PERMISSION_EDIT_OTHER_USERS *Permission
var PERMISSION_READ_CHANNEL *Permission
var PERMISSION_READ_PUBLIC_CHANNEL *Permission
var PERMISSION_PERMANENT_DELETE_USER *Permission
var PERMISSION_UPLOAD_FILE *Permission
var PERMISSION_GET_PUBLIC_LINK *Permission
var PERMISSION_MANAGE_WEBHOOKS *Permission
var PERMISSION_MANAGE_OTHERS_WEBHOOKS *Permission
var PERMISSION_MANAGE_OAUTH *Permission
var PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH *Permission
var PERMISSION_CREATE_POST *Permission
var PERMISSION_CREATE_POST_PUBLIC *Permission
var PERMISSION_EDIT_POST *Permission
var PERMISSION_EDIT_OTHERS_POSTS *Permission
var PERMISSION_DELETE_POST *Permission
var PERMISSION_DELETE_OTHERS_POSTS *Permission
var PERMISSION_REMOVE_USER_FROM_TEAM *Permission
var PERMISSION_CREATE_TEAM *Permission
var PERMISSION_MANAGE_TEAM *Permission
var PERMISSION_IMPORT_TEAM *Permission
var PERMISSION_VIEW_TEAM *Permission
var PERMISSION_LIST_USERS_WITHOUT_TEAM *Permission
var PERMISSION_MANAGE_JOBS *Permission
var PERMISSION_CREATE_USER_ACCESS_TOKEN *Permission
var PERMISSION_READ_USER_ACCESS_TOKEN *Permission
var PERMISSION_REVOKE_USER_ACCESS_TOKEN *Permission

// General permission that encompases all system admin functions
// in the future this could be broken up to allow access to some
// admin functions but not others
var PERMISSION_MANAGE_SYSTEM *Permission

const (
	SYSTEM_USER_ROLE_ID              = "system_user"
	SYSTEM_ADMIN_ROLE_ID             = "system_admin"
	SYSTEM_POST_ALL_ROLE_ID          = "system_post_all"
	SYSTEM_POST_ALL_PUBLIC_ROLE_ID   = "system_post_all_public"
	SYSTEM_USER_ACCESS_TOKEN_ROLE_ID = "system_user_access_token"

	TEAM_USER_ROLE_ID            = "team_user"
	TEAM_ADMIN_ROLE_ID           = "team_admin"
	TEAM_POST_ALL_ROLE_ID        = "team_post_all"
	TEAM_POST_ALL_PUBLIC_ROLE_ID = "team_post_all_public"

	CHANNEL_USER_ROLE_ID  = "channel_user"
	CHANNEL_ADMIN_ROLE_ID = "channel_admin"
	CHANNEL_GUEST_ROLE_ID = "guest"
)

func initializePermissions() {
	PERMISSION_INVITE_USER = &Permission{
		"invite_user",
		"authentication.permissions.team_invite_user.name",
		"authentication.permissions.team_invite_user.description",
	}
	PERMISSION_ADD_USER_TO_TEAM = &Permission{
		"add_user_to_team",
		"authentication.permissions.add_user_to_team.name",
		"authentication.permissions.add_user_to_team.description",
	}
	PERMISSION_USE_SLASH_COMMANDS = &Permission{
		"use_slash_commands",
		"authentication.permissions.team_use_slash_commands.name",
		"authentication.permissions.team_use_slash_commands.description",
	}
	PERMISSION_MANAGE_SLASH_COMMANDS = &Permission{
		"manage_slash_commands",
		"authentication.permissions.manage_slash_commands.name",
		"authentication.permissions.manage_slash_commands.description",
	}
	PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS = &Permission{
		"manage_others_slash_commands",
		"authentication.permissions.manage_others_slash_commands.name",
		"authentication.permissions.manage_others_slash_commands.description",
	}
	PERMISSION_CREATE_PUBLIC_CHANNEL = &Permission{
		"create_public_channel",
		"authentication.permissions.create_public_channel.name",
		"authentication.permissions.create_public_channel.description",
	}
	PERMISSION_CREATE_PRIVATE_CHANNEL = &Permission{
		"create_private_channel",
		"authentication.permissions.create_private_channel.name",
		"authentication.permissions.create_private_channel.description",
	}
	PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS = &Permission{
		"manage_public_channel_members",
		"authentication.permissions.manage_public_channel_members.name",
		"authentication.permissions.manage_public_channel_members.description",
	}
	PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS = &Permission{
		"manage_private_channel_members",
		"authentication.permissions.manage_private_channel_members.name",
		"authentication.permissions.manage_private_channel_members.description",
	}
	PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE = &Permission{
		"assign_system_admin_role",
		"authentication.permissions.assign_system_admin_role.name",
		"authentication.permissions.assign_system_admin_role.description",
	}
	PERMISSION_MANAGE_ROLES = &Permission{
		"manage_roles",
		"authentication.permissions.manage_roles.name",
		"authentication.permissions.manage_roles.description",
	}
	PERMISSION_MANAGE_TEAM_ROLES = &Permission{
		"manage_team_roles",
		"authentication.permissions.manage_team_roles.name",
		"authentication.permissions.manage_team_roles.description",
	}
	PERMISSION_MANAGE_CHANNEL_ROLES = &Permission{
		"manage_channel_roles",
		"authentication.permissions.manage_channel_roles.name",
		"authentication.permissions.manage_channel_roles.description",
	}
	PERMISSION_MANAGE_SYSTEM = &Permission{
		"manage_system",
		"authentication.permissions.manage_system.name",
		"authentication.permissions.manage_system.description",
	}
	PERMISSION_CREATE_DIRECT_CHANNEL = &Permission{
		"create_direct_channel",
		"authentication.permissions.create_direct_channel.name",
		"authentication.permissions.create_direct_channel.description",
	}
	PERMISSION_CREATE_GROUP_CHANNEL = &Permission{
		"create_group_channel",
		"authentication.permissions.create_group_channel.name",
		"authentication.permissions.create_group_channel.description",
	}
	PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES = &Permission{
		"manage__publicchannel_properties",
		"authentication.permissions.manage_public_channel_properties.name",
		"authentication.permissions.manage_public_channel_properties.description",
	}
	PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES = &Permission{
		"manage_private_channel_properties",
		"authentication.permissions.manage_private_channel_properties.name",
		"authentication.permissions.manage_private_channel_properties.description",
	}
	PERMISSION_LIST_TEAM_CHANNELS = &Permission{
		"list_team_channels",
		"authentication.permissions.list_team_channels.name",
		"authentication.permissions.list_team_channels.description",
	}
	PERMISSION_JOIN_PUBLIC_CHANNELS = &Permission{
		"join_public_channels",
		"authentication.permissions.join_public_channels.name",
		"authentication.permissions.join_public_channels.description",
	}
	PERMISSION_DELETE_PUBLIC_CHANNEL = &Permission{
		"delete_public_channel",
		"authentication.permissions.delete_public_channel.name",
		"authentication.permissions.delete_public_channel.description",
	}
	PERMISSION_DELETE_PRIVATE_CHANNEL = &Permission{
		"delete_private_channel",
		"authentication.permissions.delete_private_channel.name",
		"authentication.permissions.delete_private_channel.description",
	}
	PERMISSION_EDIT_OTHER_USERS = &Permission{
		"edit_other_users",
		"authentication.permissions.edit_other_users.name",
		"authentication.permissions.edit_other_users.description",
	}
	PERMISSION_READ_CHANNEL = &Permission{
		"read_channel",
		"authentication.permissions.read_channel.name",
		"authentication.permissions.read_channel.description",
	}
	PERMISSION_READ_PUBLIC_CHANNEL = &Permission{
		"read_public_channel",
		"authentication.permissions.read_public_channel.name",
		"authentication.permissions.read_public_channel.description",
	}
	PERMISSION_PERMANENT_DELETE_USER = &Permission{
		"permanent_delete_user",
		"authentication.permissions.permanent_delete_user.name",
		"authentication.permissions.permanent_delete_user.description",
	}
	PERMISSION_UPLOAD_FILE = &Permission{
		"upload_file",
		"authentication.permissions.upload_file.name",
		"authentication.permissions.upload_file.description",
	}
	PERMISSION_GET_PUBLIC_LINK = &Permission{
		"get_public_link",
		"authentication.permissions.get_public_link.name",
		"authentication.permissions.get_public_link.description",
	}
	PERMISSION_MANAGE_WEBHOOKS = &Permission{
		"manage_webhooks",
		"authentication.permissions.manage_webhooks.name",
		"authentication.permissions.manage_webhooks.description",
	}
	PERMISSION_MANAGE_OTHERS_WEBHOOKS = &Permission{
		"manage_others_webhooks",
		"authentication.permissions.manage_others_webhooks.name",
		"authentication.permissions.manage_others_webhooks.description",
	}
	PERMISSION_MANAGE_OAUTH = &Permission{
		"manage_oauth",
		"authentication.permissions.manage_oauth.name",
		"authentication.permissions.manage_oauth.description",
	}
	PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH = &Permission{
		"manage_sytem_wide_oauth",
		"authentication.permissions.manage_sytem_wide_oauth.name",
		"authentication.permissions.manage_sytem_wide_oauth.description",
	}
	PERMISSION_CREATE_POST = &Permission{
		"create_post",
		"authentication.permissions.create_post.name",
		"authentication.permissions.create_post.description",
	}
	PERMISSION_CREATE_POST_PUBLIC = &Permission{
		"create_post_public",
		"authentication.permissions.create_post_public.name",
		"authentication.permissions.create_post_public.description",
	}
	PERMISSION_EDIT_POST = &Permission{
		"edit_post",
		"authentication.permissions.edit_post.name",
		"authentication.permissions.edit_post.description",
	}
	PERMISSION_EDIT_OTHERS_POSTS = &Permission{
		"edit_others_posts",
		"authentication.permissions.edit_others_posts.name",
		"authentication.permissions.edit_others_posts.description",
	}
	PERMISSION_DELETE_POST = &Permission{
		"delete_post",
		"authentication.permissions.delete_post.name",
		"authentication.permissions.delete_post.description",
	}
	PERMISSION_DELETE_OTHERS_POSTS = &Permission{
		"delete_others_posts",
		"authentication.permissions.delete_others_posts.name",
		"authentication.permissions.delete_others_posts.description",
	}
	PERMISSION_REMOVE_USER_FROM_TEAM = &Permission{
		"remove_user_from_team",
		"authentication.permissions.remove_user_from_team.name",
		"authentication.permissions.remove_user_from_team.description",
	}
	PERMISSION_CREATE_TEAM = &Permission{
		"create_team",
		"authentication.permissions.create_team.name",
		"authentication.permissions.create_team.description",
	}
	PERMISSION_MANAGE_TEAM = &Permission{
		"manage_team",
		"authentication.permissions.manage_team.name",
		"authentication.permissions.manage_team.description",
	}
	PERMISSION_IMPORT_TEAM = &Permission{
		"import_team",
		"authentication.permissions.import_team.name",
		"authentication.permissions.import_team.description",
	}
	PERMISSION_VIEW_TEAM = &Permission{
		"view_team",
		"authentication.permissions.view_team.name",
		"authentication.permissions.view_team.description",
	}
	PERMISSION_LIST_USERS_WITHOUT_TEAM = &Permission{
		"list_users_without_team",
		"authentication.permissions.list_users_without_team.name",
		"authentication.permissions.list_users_without_team.description",
	}
	PERMISSION_CREATE_USER_ACCESS_TOKEN = &Permission{
		"create_user_access_token",
		"authentication.permissions.create_user_access_token.name",
		"authentication.permissions.create_user_access_token.description",
	}
	PERMISSION_READ_USER_ACCESS_TOKEN = &Permission{
		"read_user_access_token",
		"authentication.permissions.read_user_access_token.name",
		"authentication.permissions.read_user_access_token.description",
	}
	PERMISSION_REVOKE_USER_ACCESS_TOKEN = &Permission{
		"revoke_user_access_token",
		"authentication.permissions.revoke_user_access_token.name",
		"authentication.permissions.revoke_user_access_token.description",
	}
	PERMISSION_MANAGE_JOBS = &Permission{
		"manage_jobs",
		"authentication.permisssions.manage_jobs.name",
		"authentication.permisssions.manage_jobs.description",
	}
}

var DefaultRoles map[string]*Role

func initializeDefaultRoles() {
	DefaultRoles = make(map[string]*Role)

	DefaultRoles[CHANNEL_USER_ROLE_ID] = &Role{
		"channel_user",
		"authentication.roles.channel_user.name",
		"authentication.roles.channel_user.description",
		[]string{
			PERMISSION_READ_CHANNEL.Id,
			PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			PERMISSION_UPLOAD_FILE.Id,
			PERMISSION_GET_PUBLIC_LINK.Id,
			PERMISSION_CREATE_POST.Id,
			PERMISSION_EDIT_POST.Id,
			PERMISSION_USE_SLASH_COMMANDS.Id,
		},
	}

	DefaultRoles[CHANNEL_ADMIN_ROLE_ID] = &Role{
		"channel_admin",
		"authentication.roles.channel_admin.name",
		"authentication.roles.channel_admin.description",
		[]string{
			PERMISSION_MANAGE_CHANNEL_ROLES.Id,
		},
	}

	DefaultRoles[CHANNEL_GUEST_ROLE_ID] = &Role{
		"guest",
		"authentication.roles.global_guest.name",
		"authentication.roles.global_guest.description",
		[]string{},
	}

	DefaultRoles[TEAM_USER_ROLE_ID] = &Role{
		"team_user",
		"authentication.roles.team_user.name",
		"authentication.roles.team_user.description",
		[]string{
			PERMISSION_LIST_TEAM_CHANNELS.Id,
			PERMISSION_JOIN_PUBLIC_CHANNELS.Id,
			PERMISSION_READ_PUBLIC_CHANNEL.Id,
			PERMISSION_VIEW_TEAM.Id,
		},
	}

	DefaultRoles[TEAM_POST_ALL_ROLE_ID] = &Role{
		"team_post_all",
		"authentication.roles.team_post_all.name",
		"authentication.roles.team_post_all.description",
		[]string{
			PERMISSION_CREATE_POST.Id,
		},
	}

	DefaultRoles[TEAM_POST_ALL_PUBLIC_ROLE_ID] = &Role{
		"team_post_all_public",
		"authentication.roles.team_post_all_public.name",
		"authentication.roles.team_post_all_public.description",
		[]string{
			PERMISSION_CREATE_POST_PUBLIC.Id,
		},
	}

	DefaultRoles[TEAM_ADMIN_ROLE_ID] = &Role{
		"team_admin",
		"authentication.roles.team_admin.name",
		"authentication.roles.team_admin.description",
		[]string{
			PERMISSION_EDIT_OTHERS_POSTS.Id,
			PERMISSION_REMOVE_USER_FROM_TEAM.Id,
			PERMISSION_MANAGE_TEAM.Id,
			PERMISSION_IMPORT_TEAM.Id,
			PERMISSION_MANAGE_TEAM_ROLES.Id,
			PERMISSION_MANAGE_CHANNEL_ROLES.Id,
			PERMISSION_MANAGE_OTHERS_WEBHOOKS.Id,
			PERMISSION_MANAGE_SLASH_COMMANDS.Id,
			PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS.Id,
			PERMISSION_MANAGE_WEBHOOKS.Id,
		},
	}

	DefaultRoles[SYSTEM_USER_ROLE_ID] = &Role{
		"system_user",
		"authentication.roles.global_user.name",
		"authentication.roles.global_user.description",
		[]string{
			PERMISSION_CREATE_DIRECT_CHANNEL.Id,
			PERMISSION_CREATE_GROUP_CHANNEL.Id,
			PERMISSION_PERMANENT_DELETE_USER.Id,
		},
	}

	DefaultRoles[SYSTEM_POST_ALL_ROLE_ID] = &Role{
		"system_post_all",
		"authentication.roles.system_post_all.name",
		"authentication.roles.system_post_all.description",
		[]string{
			PERMISSION_CREATE_POST.Id,
		},
	}

	DefaultRoles[SYSTEM_POST_ALL_PUBLIC_ROLE_ID] = &Role{
		"system_post_all_public",
		"authentication.roles.system_post_all_public.name",
		"authentication.roles.system_post_all_public.description",
		[]string{
			PERMISSION_CREATE_POST_PUBLIC.Id,
		},
	}

	DefaultRoles[SYSTEM_USER_ACCESS_TOKEN_ROLE_ID] = &Role{
		"system_user_access_token",
		"authentication.roles.system_user_access_token.name",
		"authentication.roles.system_user_access_token.description",
		[]string{
			PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
			PERMISSION_READ_USER_ACCESS_TOKEN.Id,
			PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
		},
	}

	DefaultRoles[SYSTEM_ADMIN_ROLE_ID] = &Role{
		"system_admin",
		"authentication.roles.global_admin.name",
		"authentication.roles.global_admin.description",
		// System admins can do anything channel and team admins can do
		// plus everything members of teams and channels can do to all teams
		// and channels on the system
		append(
			append(
				append(
					append(
						[]string{
							PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE.Id,
							PERMISSION_MANAGE_SYSTEM.Id,
							PERMISSION_MANAGE_ROLES.Id,
							PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
							PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
							PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
							PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
							PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
							PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
							PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
							PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
							PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH.Id,
							PERMISSION_MANAGE_OTHERS_WEBHOOKS.Id,
							PERMISSION_EDIT_OTHER_USERS.Id,
							PERMISSION_MANAGE_OAUTH.Id,
							PERMISSION_INVITE_USER.Id,
							PERMISSION_DELETE_POST.Id,
							PERMISSION_DELETE_OTHERS_POSTS.Id,
							PERMISSION_CREATE_TEAM.Id,
							PERMISSION_ADD_USER_TO_TEAM.Id,
							PERMISSION_LIST_USERS_WITHOUT_TEAM.Id,
							PERMISSION_MANAGE_JOBS.Id,
							PERMISSION_CREATE_POST_PUBLIC.Id,
							PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
							PERMISSION_READ_USER_ACCESS_TOKEN.Id,
							PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
						},
						DefaultRoles[TEAM_USER_ROLE_ID].Permissions...,
					),
					DefaultRoles[CHANNEL_USER_ROLE_ID].Permissions...,
				),
				DefaultRoles[TEAM_ADMIN_ROLE_ID].Permissions...,
			),
			DefaultRoles[CHANNEL_ADMIN_ROLE_ID].Permissions...,
		),
	}
}

func RoleIdsToString(roles []string) string {
	output := ""
	for _, role := range roles {
		output += role + ", "
	}

	if output == "" {
		return "[<NO ROLES>]"
	}

	return output[:len(output)-1]
}

func init() {
	initializePermissions()
	initializeDefaultRoles()
}
