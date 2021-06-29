namespace grafana

@documentation("An alert.")
resource Alert {
  identifiers: { id: AlertId },
  read: GetAlert,
  list: ListAlerts,
}

@pattern("^[0-9]+$")
string AlertId

@readonly
@http(method: "GET", uri: "/api/alerts/{id}")
@documentation("Get an alert.")
operation GetAlert {
  input: GetAlertInput,
  output: GetAlertOutput,
  errors: [NoSuchResource],
}

structure GetAlertInput {
  @required
  @httpLabel
  @documentation("The alert ID.")
  id: AlertId,
}

@references([{resource: Alert}])
structure GetAlertOutput {
  @required
  id:             AlertId,
  @required
  version:        Long,
  @required
  orgId:          Long,
  @required
  dashboardId:    Long,
  @required
  panelId:        Long,
  @required
  name:           String,
  @required
  message:        String,
  @required
  state:          String,
  @required
  silenced:       Bool,
  @required
  frequency:      Long,
  @required
  for:            Long,
  @required
  created: Timestamp,
  updated: Timestamp,
}

@readonly
@http(method: "GET", uri: "/api/alerts")
@documentation("Get alerts.")
operation ListAlerts {
  input: ListAlertsInput,
  output: ListAlertsOutput,
}

structure ListAlertsInput {
  @httpQuery("dashboardQuery")
  dashboardQuery: String,
  @httpQuery("dashboardTag")
  dashboardTags: StringList,
  @httpQuery("dashboardId")
  dashboardIds: LongList,
  @httpQuery("folderId")
  folderIds: LongList,
}

@references([{resource: Alert}])
structure AlertSummary {
  @required
  id: AlertId,
  dashboardId: Long,
  dashboardUid: String,
  dashboardSlug: String,
  panelId: Long,
  name: String,
  state: String,
  newStateDate: Timestamp,
  evalDate: Timestamp,
  evalData: Document,
  url: String,
}

structure ListAlertsOutput {
  @required
  items: AlertSummaries,
}

list AlertSummaries {
  member: AlertSummary,
}

@readonly
@http(method: "POST", uri: "/api/alerts/test")
@documentation("Make a test alert.")
operation AlertTest {
  input: AlertTestInput,
  output: AlertTestOutput,
  errors: [BadRequest, UnprocessableEntity, Forbidden, InternalServerError],
}

structure AlertTestInput {
  @required
  dashboard: Document,
  @required
  panelId: Long,
  @httpHeader("X-Grafana-Org-Id")
  orgId: Long,
}

structure AlertTestOutput {
  @required
  firing: Bool,
  @required
  conditionEvals: String,
  @required
  state: String,
  logs: AlertTestResultLogs,
  evalMatches: EvalMatches,
  @required
  timeMs: String,
}

list AlertTestResultLogs {
  member: AlertTestResultLog,
}

structure AlertTestResultLog {
	message: String,
	data: Document,
}

list EvalMatches {
  member: EvalMatch,
}

structure EvalMatch {
  tags: StringStringMap,
  @required
  metric: String,
  @required
  value: BoxedFloat,
}
