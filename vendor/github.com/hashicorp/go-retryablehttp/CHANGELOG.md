## 0.7.7 (May 30, 2024)

BUG FIXES:

- client: avoid potentially leaking URL-embedded basic authentication credentials in logs (#158)

## 0.7.6 (May 9, 2024)

ENHANCEMENTS:

- client: support a `RetryPrepare` function for modifying the request before retrying (#216)
- client: support HTTP-date values for `Retry-After` header value (#138)
- client: avoid reading entire body when the body is a `*bytes.Reader` (#197)

BUG FIXES:

- client: fix a broken check for invalid server certificate in go 1.20+ (#210)

## 0.7.5 (Nov 8, 2023)

BUG FIXES:

- client: fixes an issue where the request body is not preserved on temporary redirects or re-established HTTP/2 connections (#207)

## 0.7.4 (Jun 6, 2023)

BUG FIXES:

- client: fixing an issue where the Content-Type header wouldn't be sent with an empty payload when using HTTP/2 (#194)

## 0.7.3 (May 15, 2023)

Initial release
