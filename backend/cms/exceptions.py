"""Every API error is returned as {"error": "<one readable sentence>"}, which is what the
admin panel and the contact form show to people."""

from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class Conflict(APIException):
    status_code = 409
    default_detail = "That conflicts with existing data."
    default_code = "conflict"


def _first_message(data):
    if isinstance(data, dict):
        if "detail" in data:
            return _first_message(data["detail"])
        for value in data.values():
            found = _first_message(value)
            if found:
                return found
        return ""
    if isinstance(data, (list, tuple)):
        for item in data:
            found = _first_message(item)
            if found:
                return found
        return ""
    return str(data)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    request = context.get("request")
    if response.status_code == 401 and request is not None and request.path.rstrip("/").endswith("/auth/token"):
        message = "Wrong email or password"
    elif response.status_code == 429:
        message = "Too many requests. Please wait a little and try again."
    else:
        message = _first_message(response.data) or "Request failed"
    response.data = {"error": message}
    return response
