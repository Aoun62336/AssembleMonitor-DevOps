# NOT APPLIED. This file is written and plan-validated only.
# No domain is registered for this project. Public access uses
# the CloudFront default domain from cloudfront_domain_name output.
# Set var.create_dns = true and provide a real var.domain_name to activate this file.

variable "create_dns" {
  description = "Set to true only if a real domain has been purchased and Route 53 should be applied"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Root domain name, only used if create_dns is true"
  type        = string
  default     = ""
}

resource "aws_route53_zone" "primary" {
  count = var.create_dns ? 1 : 0
  name  = var.domain_name

  tags = local.common_tags
}

resource "aws_acm_certificate" "app_cert" {
  count             = var.create_dns ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = ["www.${var.domain_name}"]

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

resource "aws_route53_record" "cert_validation" {
  for_each = var.create_dns ? {
    for dvo in aws_acm_certificate.app_cert[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id = aws_route53_zone.primary[0].zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "app_cert" {
  count                   = var.create_dns ? 1 : 0
  certificate_arn         = aws_acm_certificate.app_cert[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

resource "aws_route53_record" "app_alias" {
  count   = var.create_dns ? 1 : 0
  zone_id = aws_route53_zone.primary[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.app_alb.dns_name
    zone_id                = aws_lb.app_alb.zone_id
    evaluate_target_health = false
  }
}
