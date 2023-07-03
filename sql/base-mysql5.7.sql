SELECT
                        dashboard.id,
                        dashboard.uid,
                        dashboard.title,
                        dashboard.slug,
                        dashboard_tag.term,
                        dashboard.is_folder,
                        dashboard.folder_id,
                        folder.uid AS folder_uid,
                        folder.slug AS folder_slug,
                        folder.title AS folder_title 
                FROM dashboard
                LEFT OUTER JOIN dashboard AS folder ON folder.id = dashboard.folder_id
                LEFT OUTER JOIN dashboard_tag ON dashboard.id = dashboard_tag.dashboard_id
 WHERE (dashboard.uid IN (SELECT substr(scope, 16) FROM permission WHERE scope LIKE 'dashboards:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read") AND NOT dashboard.is_folder) OR ((dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  WHERE f1.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  WHERE f2.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  INNER JOIN folder f3 ON f2.parent_uid = f3.uid AND f2.org_id = f3.org_id  WHERE f3.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  INNER JOIN folder f3 ON f2.parent_uid = f3.uid AND f2.org_id = f3.org_id  INNER JOIN folder f4 ON f3.parent_uid = f4.uid AND f3.org_id = f4.org_id  WHERE f4.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  INNER JOIN folder f3 ON f2.parent_uid = f3.uid AND f2.org_id = f3.org_id  INNER JOIN folder f4 ON f3.parent_uid = f4.uid AND f3.org_id = f4.org_id  INNER JOIN folder f5 ON f4.parent_uid = f5.uid AND f4.org_id = f5.org_id  WHERE f5.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  INNER JOIN folder f3 ON f2.parent_uid = f3.uid AND f2.org_id = f3.org_id  INNER JOIN folder f4 ON f3.parent_uid = f4.uid AND f3.org_id = f4.org_id  INNER JOIN folder f5 ON f4.parent_uid = f5.uid AND f4.org_id = f5.org_id  INNER JOIN folder f6 ON f5.parent_uid = f6.uid AND f5.org_id = f6.org_id  WHERE f6.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  INNER JOIN folder f3 ON f2.parent_uid = f3.uid AND f2.org_id = f3.org_id  INNER JOIN folder f4 ON f3.parent_uid = f4.uid AND f3.org_id = f4.org_id  INNER JOIN folder f5 ON f4.parent_uid = f5.uid AND f4.org_id = f5.org_id  INNER JOIN folder f6 ON f5.parent_uid = f6.uid AND f5.org_id = f6.org_id  INNER JOIN folder f7 ON f6.parent_uid = f7.uid AND f6.org_id = f7.org_id  WHERE f7.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  INNER JOIN folder f3 ON f2.parent_uid = f3.uid AND f2.org_id = f3.org_id  INNER JOIN folder f4 ON f3.parent_uid = f4.uid AND f3.org_id = f4.org_id  INNER JOIN folder f5 ON f4.parent_uid = f5.uid AND f4.org_id = f5.org_id  INNER JOIN folder f6 ON f5.parent_uid = f6.uid AND f5.org_id = f6.org_id  INNER JOIN folder f7 ON f6.parent_uid = f7.uid AND f6.org_id = f7.org_id  INNER JOIN folder f8 ON f7.parent_uid = f8.uid AND f7.org_id = f8.org_id  WHERE f8.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  INNER JOIN folder f3 ON f2.parent_uid = f3.uid AND f2.org_id = f3.org_id  INNER JOIN folder f4 ON f3.parent_uid = f4.uid AND f3.org_id = f4.org_id  INNER JOIN folder f5 ON f4.parent_uid = f5.uid AND f4.org_id = f5.org_id  INNER JOIN folder f6 ON f5.parent_uid = f6.uid AND f5.org_id = f6.org_id  INNER JOIN folder f7 ON f6.parent_uid = f7.uid AND f6.org_id = f7.org_id  INNER JOIN folder f8 ON f7.parent_uid = f8.uid AND f7.org_id = f8.org_id  INNER JOIN folder f9 ON f8.parent_uid = f9.uid AND f8.org_id = f9.org_id  WHERE f9.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard d INNER JOIN folder f1 ON d.uid = f1.uid AND d.org_id = f1.org_id  INNER JOIN folder f2 ON f1.parent_uid = f2.uid AND f1.org_id = f2.org_id  INNER JOIN folder f3 ON f2.parent_uid = f3.uid AND f2.org_id = f3.org_id  INNER JOIN folder f4 ON f3.parent_uid = f4.uid AND f3.org_id = f4.org_id  INNER JOIN folder f5 ON f4.parent_uid = f5.uid AND f4.org_id = f5.org_id  INNER JOIN folder f6 ON f5.parent_uid = f6.uid AND f5.org_id = f6.org_id  INNER JOIN folder f7 ON f6.parent_uid = f7.uid AND f6.org_id = f7.org_id  INNER JOIN folder f8 ON f7.parent_uid = f8.uid AND f7.org_id = f8.org_id  INNER JOIN folder f9 ON f8.parent_uid = f9.uid AND f8.org_id = f9.org_id  INNER JOIN folder f10 ON f9.parent_uid = f10.uid AND f9.org_id = f10.org_id  WHERE f10.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
                role_id IN (
                        SELECT ur.role_id
                        FROM user_role AS ur
                        WHERE ur.user_id = 1
                        AND (ur.org_id = 1 OR ur.org_id = 0)
                )
                OR
                role_id IN (
                        SELECT tr.role_id FROM team_role as tr
                        WHERE tr.team_id IN(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50)
                        AND tr.org_id = 1
                )
                OR
                role_id IN (
                        SELECT br.role_id FROM builtin_role AS br
                        WHERE br.role IN ("")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = "dashboards:read"))) AND NOT dashboard.is_folder) AND dashboard.org_id=1 AND dashboard.is_folder = 0 ORDER BY dashboard.title ASC LIMIT 5000 OFFSET 0

+----+--------------------+---------------+------------+--------+-------------------------------------------------------------------------------------------------------------------------------------------+--------------------------------------+---------+--------------------------------------------------------+-------+----------+----------------------------------------------------+
| id | select_type        | table         | partitions | type   | possible_keys                                                                                                                             | key                                  | key_len | ref                                                    | rows  | filtered | Extra                                              |
+----+--------------------+---------------+------------+--------+-------------------------------------------------------------------------------------------------------------------------------------------+--------------------------------------+---------+--------------------------------------------------------+-------+----------+----------------------------------------------------+
|  1 | PRIMARY            | dashboard     | NULL       | index  | UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id,IDX_dashboard_is_folder | IDX_dashboard_title                  | 758     | NULL                                                   |  5000 |    10.90 | Using where                                        |
|  1 | PRIMARY            | folder        | NULL       | eq_ref | PRIMARY                                                                                                                                   | PRIMARY                              | 8       | grafana_tests.dashboard.folder_id                      |     1 |   100.00 | NULL                                               |
|  1 | PRIMARY            | dashboard_tag | NULL       | ref    | IDX_dashboard_tag_dashboard_id                                                                                                            | IDX_dashboard_tag_dashboard_id       | 8       | grafana_tests.dashboard.id                             |     1 |   100.00 | NULL                                               |
| 51 | SUBQUERY           | <subquery52>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 51 | SUBQUERY           | f10           | NULL       | ref    | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 162     | <subquery52>.substr(scope, 13)                         |     1 |   100.00 | Using where; Using index                           |
| 51 | SUBQUERY           | f2            | NULL       | ALL    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | NULL                                 | NULL    | NULL                                                   | 54121 |    10.00 | Using where; Using join buffer (Block Nested Loop) |
| 51 | SUBQUERY           | f3            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f2.parent_uid,grafana_tests.f10.org_id   |     1 |   100.00 | Using where                                        |
| 51 | SUBQUERY           | f4            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f3.parent_uid,grafana_tests.f10.org_id   |     1 |   100.00 | Using where                                        |
| 51 | SUBQUERY           | f5            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f4.parent_uid,grafana_tests.f10.org_id   |     1 |   100.00 | Using where                                        |
| 51 | SUBQUERY           | f6            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f5.parent_uid,grafana_tests.f10.org_id   |     1 |   100.00 | Using where                                        |
| 51 | SUBQUERY           | f7            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f6.parent_uid,grafana_tests.f10.org_id   |     1 |   100.00 | Using where                                        |
| 51 | SUBQUERY           | f8            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f7.parent_uid,grafana_tests.f10.org_id   |     1 |   100.00 | Using where                                        |
| 51 | SUBQUERY           | f9            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f8.parent_uid,grafana_tests.f10.org_id   |     1 |     5.00 | Using where                                        |
| 51 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f2.uid,grafana_tests.f10.org_id          |     6 |   100.00 | NULL                                               |
| 51 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f10.org_id,grafana_tests.f1.uid          |     1 |   100.00 | Using index                                        |
| 52 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 55 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 54 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 53 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
| 46 | SUBQUERY           | <subquery47>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 46 | SUBQUERY           | f9            | NULL       | ref    | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 162     | <subquery47>.substr(scope, 13)                         |     1 |   100.00 | Using where; Using index                           |
| 46 | SUBQUERY           | f2            | NULL       | ALL    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | NULL                                 | NULL    | NULL                                                   | 54121 |    10.00 | Using where; Using join buffer (Block Nested Loop) |
| 46 | SUBQUERY           | f3            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f2.parent_uid,grafana_tests.f9.org_id    |     1 |   100.00 | Using where                                        |
| 46 | SUBQUERY           | f4            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f3.parent_uid,grafana_tests.f9.org_id    |     1 |   100.00 | Using where                                        |
| 46 | SUBQUERY           | f5            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f4.parent_uid,grafana_tests.f9.org_id    |     1 |   100.00 | Using where                                        |
| 46 | SUBQUERY           | f6            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f5.parent_uid,grafana_tests.f9.org_id    |     1 |   100.00 | Using where                                        |
| 46 | SUBQUERY           | f7            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f6.parent_uid,grafana_tests.f9.org_id    |     1 |   100.00 | Using where                                        |
| 46 | SUBQUERY           | f8            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f7.parent_uid,grafana_tests.f9.org_id    |     1 |     5.00 | Using where                                        |
| 46 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f2.uid,grafana_tests.f9.org_id           |     6 |   100.00 | NULL                                               |
| 46 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f9.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
| 47 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 50 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 49 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 48 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
| 41 | SUBQUERY           | <subquery42>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 41 | SUBQUERY           | f8            | NULL       | ref    | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 162     | <subquery42>.substr(scope, 13)                         |     1 |   100.00 | Using where; Using index                           |
| 41 | SUBQUERY           | f2            | NULL       | ALL    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | NULL                                 | NULL    | NULL                                                   | 54121 |    10.00 | Using where; Using join buffer (Block Nested Loop) |
| 41 | SUBQUERY           | f3            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f2.parent_uid,grafana_tests.f8.org_id    |     1 |   100.00 | Using where                                        |
| 41 | SUBQUERY           | f4            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f3.parent_uid,grafana_tests.f8.org_id    |     1 |   100.00 | Using where                                        |
| 41 | SUBQUERY           | f5            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f4.parent_uid,grafana_tests.f8.org_id    |     1 |   100.00 | Using where                                        |
| 41 | SUBQUERY           | f6            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f5.parent_uid,grafana_tests.f8.org_id    |     1 |   100.00 | Using where                                        |
| 41 | SUBQUERY           | f7            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f6.parent_uid,grafana_tests.f8.org_id    |     1 |     5.00 | Using where                                        |
| 41 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f2.uid,grafana_tests.f8.org_id           |     6 |   100.00 | NULL                                               |
| 41 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f8.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
| 42 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 45 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 44 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 43 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
| 36 | SUBQUERY           | <subquery37>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 36 | SUBQUERY           | f7            | NULL       | ref    | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 162     | <subquery37>.substr(scope, 13)                         |     1 |   100.00 | Using where; Using index                           |
| 36 | SUBQUERY           | f2            | NULL       | ALL    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | NULL                                 | NULL    | NULL                                                   | 54121 |    10.00 | Using where; Using join buffer (Block Nested Loop) |
| 36 | SUBQUERY           | f3            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f2.parent_uid,grafana_tests.f7.org_id    |     1 |   100.00 | Using where                                        |
| 36 | SUBQUERY           | f4            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f3.parent_uid,grafana_tests.f7.org_id    |     1 |   100.00 | Using where                                        |
| 36 | SUBQUERY           | f5            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f4.parent_uid,grafana_tests.f7.org_id    |     1 |   100.00 | Using where                                        |
| 36 | SUBQUERY           | f6            | NULL       | eq_ref | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | UQE_folder_uid_org_id                | 170     | grafana_tests.f5.parent_uid,grafana_tests.f7.org_id    |     1 |     5.00 | Using where                                        |
| 36 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f2.uid,grafana_tests.f7.org_id           |     6 |   100.00 | NULL                                               |
| 36 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f7.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
| 37 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 40 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 39 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 38 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
| 31 | SUBQUERY           | <subquery32>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 31 | SUBQUERY           | f5            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 163     | <subquery32>.substr(scope, 13)                         |     5 |   100.00 | Using index condition                              |
| 31 | SUBQUERY           | f6            | NULL       | eq_ref | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 170     | <subquery32>.substr(scope, 13),grafana_tests.f5.org_id |     1 |   100.00 | Using where; Using index                           |
| 31 | SUBQUERY           | f4            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f5.uid,grafana_tests.f5.org_id           |     6 |   100.00 | NULL                                               |
| 31 | SUBQUERY           | f3            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f4.uid,grafana_tests.f5.org_id           |     6 |   100.00 | NULL                                               |
| 31 | SUBQUERY           | f2            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f3.uid,grafana_tests.f5.org_id           |     6 |   100.00 | NULL                                               |
| 31 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f2.uid,grafana_tests.f5.org_id           |     6 |   100.00 | NULL                                               |
| 31 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f5.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
| 32 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 35 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 34 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 33 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
| 26 | SUBQUERY           | <subquery27>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 26 | SUBQUERY           | f4            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 163     | <subquery27>.substr(scope, 13)                         |     5 |   100.00 | Using index condition                              |
| 26 | SUBQUERY           | f5            | NULL       | eq_ref | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 170     | <subquery27>.substr(scope, 13),grafana_tests.f4.org_id |     1 |   100.00 | Using where; Using index                           |
| 26 | SUBQUERY           | f3            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f4.uid,grafana_tests.f4.org_id           |     6 |   100.00 | NULL                                               |
| 26 | SUBQUERY           | f2            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f3.uid,grafana_tests.f4.org_id           |     6 |   100.00 | NULL                                               |
| 26 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f2.uid,grafana_tests.f4.org_id           |     6 |   100.00 | NULL                                               |
| 26 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f4.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
| 27 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 30 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 29 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 28 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
| 21 | SUBQUERY           | <subquery22>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 21 | SUBQUERY           | f4            | NULL       | ref    | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 162     | <subquery22>.substr(scope, 13)                         |     1 |   100.00 | Using where; Using index                           |
| 21 | SUBQUERY           | f3            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | <subquery22>.substr(scope, 13),grafana_tests.f4.org_id |     6 |   100.00 | Using index condition                              |
| 21 | SUBQUERY           | f2            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f3.uid,grafana_tests.f4.org_id           |     6 |   100.00 | NULL                                               |
| 21 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f2.uid,grafana_tests.f4.org_id           |     6 |   100.00 | NULL                                               |
| 21 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f4.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
| 22 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 25 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 24 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 23 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
| 16 | SUBQUERY           | <subquery17>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 16 | SUBQUERY           | f3            | NULL       | ref    | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 162     | <subquery17>.substr(scope, 13)                         |     1 |   100.00 | Using where; Using index                           |
| 16 | SUBQUERY           | f2            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f3.uid,grafana_tests.f3.org_id           |     6 |   100.00 | NULL                                               |
| 16 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | grafana_tests.f2.uid,grafana_tests.f3.org_id           |     6 |   100.00 | NULL                                               |
| 16 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f3.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
| 17 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 20 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 19 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 18 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
| 11 | SUBQUERY           | <subquery12>  | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
| 11 | SUBQUERY           | f2            | NULL       | ref    | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 162     | <subquery12>.substr(scope, 13)                         |     1 |   100.00 | Using where; Using index                           |
| 11 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id,IDX_folder_parent_uid_org_id                                                                                        | IDX_folder_parent_uid_org_id         | 171     | <subquery12>.substr(scope, 13),grafana_tests.f2.org_id |     6 |   100.00 | Using index condition                              |
| 11 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f2.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
| 12 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 15 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
| 14 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
| 13 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
|  6 | SUBQUERY           | <subquery7>   | NULL       | ALL    | NULL                                                                                                                                      | NULL                                 | NULL    | NULL                                                   |  NULL |   100.00 | NULL                                               |
|  6 | SUBQUERY           | f1            | NULL       | ref    | UQE_folder_uid_org_id                                                                                                                     | UQE_folder_uid_org_id                | 162     | <subquery7>.substr(scope, 13)                          |     1 |   100.00 | Using where; Using index                           |
|  6 | SUBQUERY           | d             | NULL       | ref    | PRIMARY,UQE_dashboard_org_id_folder_id_title,UQE_dashboard_org_id_uid,IDX_dashboard_org_id,IDX_dashboard_org_id_plugin_id                 | UQE_dashboard_org_id_uid             | 171     | grafana_tests.f1.org_id,grafana_tests.f1.uid           |     1 |   100.00 | Using index                                        |
|  7 | MATERIALIZED       | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
| 10 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
|  9 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
|  8 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
|  2 | DEPENDENT SUBQUERY | permission    | NULL       | index  | NULL                                                                                                                                      | UQE_permission_role_id_action_scope  | 1532    | NULL                                                   |   600 |     1.11 | Using where; Using index                           |
|  5 | SUBQUERY           | br            | NULL       | ref    | UQE_builtin_role_org_id_role_id_role,IDX_builtin_role_role_id,IDX_builtin_role_role,IDX_builtin_role_org_id                               | IDX_builtin_role_role                | 762     | const                                                  |     1 |   100.00 | Using where                                        |
|  4 | SUBQUERY           | tr            | NULL       | ref    | UQE_team_role_org_id_team_id_role_id,IDX_team_role_org_id,IDX_team_role_team_id                                                           | UQE_team_role_org_id_team_id_role_id | 8       | const                                                  |    50 |   100.00 | Using where; Using index                           |
|  3 | SUBQUERY           | ur            | NULL       | ref    | UQE_user_role_org_id_user_id_role_id,IDX_user_role_org_id,IDX_user_role_user_id                                                           | IDX_user_role_user_id                | 8       | const                                                  |     1 |   100.00 | Using where                                        |
+----+--------------------+---------------+------------+--------+-------------------------------------------------------------------------------------------------------------------------------------------+--------------------------------------+---------+--------------------------------------------------------+-------+----------+----------------------------------------------------+
122 rows in set, 1 warning (0.12 sec)