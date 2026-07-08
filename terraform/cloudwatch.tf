resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_targets" {
  alarm_name          = "${local.name_prefix}-alb-unhealthy-targets"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alarm when ALB has unhealthy targets"

  dimensions = {
    TargetGroup  = aws_lb_target_group.app_tg.arn_suffix
    LoadBalancer = aws_lb.app_alb.arn_suffix
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-unhealthy-targets"
  })
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alarm when RDS CPU is high"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-cpu-high"
  })
}

resource "aws_cloudwatch_metric_alarm" "asg_cpu_high" {
  alarm_name          = "${local.name_prefix}-asg-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alarm when app EC2 CPU is high"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app_asg.name
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-asg-cpu-high"
  })
}

resource "aws_cloudwatch_metric_alarm" "alb_target_5xx_high" {
  alarm_name          = "${local.name_prefix}-alb-target-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alarm when backend targets return too many 5xx errors"

  dimensions = {
    TargetGroup  = aws_lb_target_group.app_tg.arn_suffix
    LoadBalancer = aws_lb.app_alb.arn_suffix
  }

  treat_missing_data = "notBreaching"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-target-5xx-high"
  })
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "${local.name_prefix}-rds-free-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2147483648
  alarm_description   = "Alarm when RDS free storage is below 2 GB"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  treat_missing_data = "notBreaching"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-free-storage-low"
  })
}
