resource "aws_cloudfront_distribution" "app_cdn" {
  enabled             = true
  default_root_object = ""
  comment             = "${local.name_prefix}-cdn"

  origin {
    domain_name = aws_lb.app_alb.dns_name
    origin_id   = "${local.name_prefix}-alb-origin"

    custom_origin_config {
      http_port              = 80
      https_port              = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods          = ["GET", "HEAD"]
    target_origin_id        = "${local.name_prefix}-alb-origin"
    viewer_protocol_policy   = "redirect-to-https"

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 604800
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    allowed_methods           = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "${local.name_prefix}-alb-origin"
    viewer_protocol_policy     = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Host"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cdn"
  })
}
