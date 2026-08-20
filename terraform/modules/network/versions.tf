# =============================================================================
# Module: network — Required Provider Versions
#
# Declares provider constraints without configuring the provider itself.
# The calling root module is responsible for provider configuration.
# Minimum Terraform version: 1.7.0 (required for 'terraform test' + mock_provider).
# =============================================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
