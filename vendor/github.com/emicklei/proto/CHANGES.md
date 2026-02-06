## v1.14.2 (2025-06-18)

- fix parsing options for extensions (ISSUE #150)

## v1.14.1 (2025-04-29)

- fix option name with brackets (ISSUE #148)

## v1.14.0 (2024-12-18)

- parse edition element (PR #147, ISSUE #145)

## v1.13.4 (2024-12-17)

- fixed handling identifiers known as numbers by scanner (PR #146)

## v1.13.3 (2024-12-04)

- fixed inline comment in option (#143)

## v1.13.2 (2024-01-24)

- allow keyword as field name (such as message,service, etc)

## v1.13.1 (2024-01-24)

- allow embedded comment in between normal field parts (#131)

## v1.13.0 (2023-12-09)

- walk options in Enum fields (#140)

## v1.12.2 (2023-11-02)

- allow comments in array of literals of option (#138)
- adds Comment field in Literal

## v1.12.1 (2023-07-18)

- add IsDeprecated on EnumField

## v1.12.0 (2023-07-14)

- add IsDeprecated on Field

## v1.11.2 (2023-05-01)

- fix Parse failure on negative reserved enums (#133)

## v1.11.1 (2022-12-01)

- added Doc for MapField so it implements Documented

## v1.11.0

- added WithNormalField handler

## v1.10.0

- added NoopVisitor and updated README with an example

## v1.9.2

- fix for scanning content of single-quote option values (#129)

## v1.9.1

- fix for issue #127 reserved keyword as suffix in type (#128)

## v1.9.0

- Fix & guard Parent value for options (#124)  

## v1.8.0

- Add WithImport handler.

## v1.7.0

- Add WithPackage handler for walking a proto.

## v1.6.17

- add Oneof documented

## v1.6.16

- Handle inline comments before definition body

## v1.6.15

- Handle scanner change in Go 1.13

## v1.6.14

- Handle comment inside option array value

## v1.6.13

- fixes breaking change introduced by v1.6.11 w.r.t Literal

## < v1.6.12

 - see git log