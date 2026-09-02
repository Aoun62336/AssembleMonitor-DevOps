# network — Terraform Module

Reusable private-networking module for an existing VPC. Extracted from the root Terraform configuration so the networking logic can be tested independently, without AWS credentials, using Terraform's native `mock_provider`.

## Why this module exists

The main `terraform/` configuration uses the AWS default VPC. EKS node groups and RDS subnet groups require private subnets — subnets with no public IP auto-assignment and egress through a NAT Gateway. Extracting this into a module allows the subnet/NAT/routing logic to be unit-tested in CI without AWS access.

## What it creates

```
private subnets (one per entry in private_subnet_cidr_map)
NAT Gateway         (placed in the provided public subnet)
Elastic IP          (attached to the NAT Gateway)
private route table (default route → NAT Gateway)
route table associations (one per private subnet)
```

## Inputs

| Variable | Type | Description |
|---|---|---|
| `vpc_id` | `string` | ID of the existing VPC |
| `public_subnet_id` | `string` | ID of a public subnet where the NAT Gateway is placed |
| `name_prefix` | `string` | Prefix for all resource names |
| `aws_region` | `string` | Region; used to build AZ names (e.g. `us-east-1a`) |
| `private_subnet_cidr_map` | `map(string)` | AZ suffix → CIDR, e.g. `{ a = "172.31.96.0/24", b = "172.31.97.0/24" }`. At least one entry required. |
| `tags` | `map(string)` | Tags merged onto all resources. Defaults to `{}`. |

## Outputs

| Output | Description |
|---|---|
| `private_subnet_ids` | Map of AZ suffix → subnet ID |
| `private_subnet_id_list` | Ordered list of subnet IDs (for EKS node group and RDS subnet group) |
| `nat_gateway_id` | NAT Gateway ID |
| `nat_eip_public_ip` | Public IP of the NAT EIP (for security group allowlisting) |
| `private_route_table_id` | Route table ID (for associating additional subnets outside this module) |

## Native tests (`terraform test`)

Five tests in `tests/network_unit.tftest.hcl`. All use `command = plan` with `mock_provider "aws"` — no AWS credentials required.

| Test | What it verifies |
|---|---|
| `creates_correct_number_of_subnets` | A two-entry CIDR map produces exactly two private subnets with the correct CIDR blocks |
| `private_subnets_disable_public_ip` | Every private subnet has `map_public_ip_on_launch = false` |
| `nat_gateway_placed_in_correct_subnet` | The NAT Gateway is placed in the caller-provided public subnet |
| `route_table_has_default_nat_route` | The private route table contains a `0.0.0.0/0` default route |
| `rejects_empty_subnet_map` | The input validation rule rejects an empty `private_subnet_cidr_map` |

## Running the tests

```bash
cd terraform/modules/network
terraform init -backend=false
terraform test
# Success! 5 passed, 0 failed.
```

No AWS credentials are required. `mock_provider "aws"` stubs all API calls; tests run against the planned configuration only.
