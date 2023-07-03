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
                ) AND action = "dashboards:read") AND NOT dashboard.is_folder) OR (folder.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
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
                ) AND action = "dashboards:read") AND NOT dashboard.is_folder) AND dashboard.org_id=1 AND dashboard.is_folder = 0 ORDER BY dashboard.title ASC LIMIT 5000 OFFSET 0


docker compose exec mysqltests mysql -u grafana -p grafana_tests -e "
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
                        WHERE br.role IN (\"\")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = \"dashboards:read\") AND NOT dashboard.is_folder) OR (folder.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
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
                        WHERE br.role IN (\"\")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = \"dashboards:read\") AND NOT dashboard.is_folder) AND dashboard.org_id=1 AND dashboard.is_folder = 0 ORDER BY dashboard.title ASC LIMIT 5000 OFFSET 0


" | tee failing.out


docker compose exec mysqltests mysql -u grafana -p grafana_tests -e "
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
                        WHERE br.role IN (\"\")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = \"dashboards:read\") AND NOT dashboard.is_folder) OR (dashboard.folder_id IN (SELECT d.id FROM dashboard as d WHERE d.uid IN (SELECT substr(scope, 13) FROM permission WHERE scope LIKE 'folders:uid:%' AND (
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
                        WHERE br.role IN (\"\")
                        AND (br.org_id = 1 OR br.org_id = 0)
                )
                ) AND action = \"dashboards:read\")) AND NOT dashboard.is_folder) AND dashboard.org_id=1 AND dashboard.is_folder = 0 ORDER BY dashboard.title ASC LIMIT 5000 OFFSET 0
" | tee current.out