namespace grafana

@error("client")
@httpError(404)
structure NoSuchResource {
    @required
    message: String
}

@error("client")
@httpError(400)
structure BadRequest {
    @required
    message: String
}

@error("client")
@httpError(422)
structure UnprocessableEntity {
    @required
    message: String
}

@error("client")
@httpError(403)
structure Forbidden {
    @required
    message: String
}

@error("server")
@httpError(500)
structure InternalServerError {
    @required
    message: String
}
