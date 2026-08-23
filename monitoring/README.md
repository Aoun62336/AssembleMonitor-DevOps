# Monitoring Configuration

This directory contains the configurations for the monitoring stack deployed natively on the Application Server EC2 instance.

## Telemetry Components

- `prometheus.yml`: Core Prometheus configuration defining scrape targets and intervals.
- `systemd/prometheus.service`: systemd unit file for the Prometheus daemon.
- `systemd/node_exporter.service`: systemd unit file for the Node Exporter daemon.

## Grafana Configuration

Grafana is provisioned via the Web UI. The custom `grafana.ini` configuration, which maps the service to port `3005`, is persisted here for disaster recovery.

- **Configuration Path**: `grafana/grafana.ini`
- **Data Source Binding**: Prometheus (`http://localhost:9090`)
- **Dashboard Provisioning**: Provisioned manually via the UI. 

> [!TIP]
> To ensure infrastructure-as-code consistency, Grafana dashboards should be exported as JSON artifacts and persisted within a `grafana/dashboards/` directory in future iterations.
