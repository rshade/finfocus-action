# Pulumi AWS Demo

Complete working example for the
[finfocus-action](https://github.com/rshade/finfocus-action)
GitHub Action.

> Migrated from the standalone
> [finfocus-demo](https://github.com/rshade/finfocus-demo)
> repository.

## What It Provisions

A sample Pulumi YAML program that provisions AWS EC2 infrastructure:

- VPC with DNS hostname support
- Subnet in us-east-1a
- Security Group with HTTP ingress
- 20GB gp3 EBS Volume
- 3 EC2 Instances (t3.micro, t2.medium, t3.large) to demonstrate
  cost differences and upgrade recommendations

## Workflows

Four GitHub Actions workflows demonstrate different configurations:

| Workflow | Mode | Ref | Purpose |
|----------|------|-----|---------|
| `demo-cost-estimate.yml` | Standard | `./` | Integration test |
| `demo-cost-estimate-release.yml` | Standard | `@v1` | Release test |
| `demo-analyzer-mode.yml` | Analyzer | `./` | Integration test |
| `demo-analyzer-mode-release.yml` | Analyzer | `@v1` | Release test |

## Setup

### Step 1: Create AWS OIDC Identity Provider

1. Go to **IAM Console > Identity providers > Add provider**
2. Select **OpenID Connect**
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click **Add provider**

### Step 2: Create IAM Role

Create an IAM role with this trust policy (replace values):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:rshade/finfocus-action:*"
        }
      }
    }
  ]
}
```

Attach a policy with EC2/VPC read permissions (e.g., `AmazonEC2ReadOnlyAccess`).

### Step 3: Add GitHub Secret

Add this secret to the repository (**Settings > Secrets and variables > Actions**):

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_ROLE_NAME` |

## Example Change to Test

Edit `Pulumi.yaml` and change the instance type:

```yaml
# Change this:
instanceType: t3.micro

# To this:
instanceType: t3.large
```

This will show the cost difference in the PR comment.

## Notes

- Uses local Pulumi file backend (no Pulumi Cloud account needed)
- AWS OIDC provides temporary credentials (no static keys)
- Only runs `pulumi preview` -- no resources are created
- `aws-public` plugin uses public AWS pricing data

## Links

- [finfocus-action](https://github.com/rshade/finfocus-action)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [AWS OIDC for GitHub Actions](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
