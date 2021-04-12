namespace grafana

use aws.protocols#restJson1

/// The Grafana server.
@restJson1
service Grafana {
    version: "2021-04-07",
    operations: [QueryMetricsV2]
}

@readonly
@http(method: "POST", uri: "/api/ds/query")
operation QueryMetricsV2 {
  output: QueryDataResponse,
  input: QueryMetricsInput
}

structure QueryMetricsInput {
    @required
    from: String,
    @required
    to: String,
    debug: Boolean
}

structure QueryDataResponse {
  @required
  Responses: DataResponseMap
}

map DataResponseMap {
  key: String,
  value: DataResponse
}

list Frames {
  member: Frame
}

structure Frame {
  Name: String
}

structure DataResponse {
  Frames: Frames
}
