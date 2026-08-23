# =============================================================================
# Example: modular-network — Provider Configuration
#
# Configures the AWS provider for this example root module.
# No remote backend is configured — this example is validated in CI with
# -backend=false and is never applied to real infrastructure.
#
# Required Terraform version is ">= 1.7.0" (same constraint as the module)
# to ensure compatibility with terraform test + mock_provider.
# =============================================================================

terraform {
  required_version = ">= 1.7.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
