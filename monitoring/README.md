# Monitoring Configuration

This directory contains the Infrastructure as Code (IaC) configuration for the monitoring stack running natively on the App Server EC2 instance.

## Files
- `prometheus.yml`: The main configuration file for Prometheus (determines scrape targets).
- `systemd/prometheus.service`: The systemd service file to keep Prometheus running in the background.
- `systemd/node_exporter.service`: The systemd service file to keep Node Exporter running in the background.

## Grafana Setup
Grafana was configured manually via the Web UI. We have backed up the `grafana.ini` file which overrides the default port to `3005`.
- **Config File**: `grafana/grafana.ini`
- **Data Source**: Prometheus (`http://localhost:9090`)
- **Dashboards**: Created and imported manually via the UI.

*Best Practice for the future: Export your Grafana dashboards as JSON files and save them in a `grafana/dashboards/` folder here to maintain a complete backup.*
