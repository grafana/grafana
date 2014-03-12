# uptime panel

This panel renders a single percentage of "uptime" for a "service."

At Lyft we define web services by two Key Performance Indicators
(KPI's):  95th percentile response time in milliseconds, and error
rate (rate of HTTP 500's).  A service is considered to be "up" when
it is meeting a Service-Level Agreement (SLA) for both of it's
KPI's.  So, for example, we might say that the "Foo Service" is up
when it's 95th percentile response time is below 200 milliseconds
and its error rate is below 0.01%.

This panel adds a simple uptime number to grafana dashboards.
Uptime is calculated as the percentage of time that the given
service is below its threshold on both metrics.

Typically we use this as part of a row that contains the KPI graphs
(with thresholds).

## How to use this panel

Add "uptime" to your config.js:

    panel_names: [
      'text',
      'graphite',
      'uptime',
    ]

Add an uptime panel to your dashboard, and specify targets and thresholds.
Targets are graphite functions, and thresholds are limits for the targets.

## TODO

Due to my inexperience with angular, this component is pretty inflexible.
It would be nice if: 
* the list of targets and thresholds was not hard-coded to two, but was adjustable
* the target re-used the grafana target selection UI
* the threshold could be a min or max

