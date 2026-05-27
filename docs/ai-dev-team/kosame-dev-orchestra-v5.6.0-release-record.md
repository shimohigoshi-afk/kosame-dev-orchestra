# KOSAME Dev Orchestra v5.6.0 Provider Health Auto Reporter

## Purpose

This release automates provider health evaluation, generating status reports with warning and critical thresholds based on success rate and latency.

## Health Thresholds

| Metric        | Warning      | Critical      |
|---------------|--------------|---------------|
| Success Rate  | < 0.80       | < 0.50        |
| Latency       | > 5,000 ms   | > 15,000 ms   |

## Report Fields

- `status`: healthy / warning / critical
- `alerts`: list of triggered threshold alerts
- `criticalProviders`: providers with critical status

## Release Value

v5.6.0 gives こさめ副社長 a real-time health overview of all providers, enabling proactive fallback decisions before providers fail completely.
