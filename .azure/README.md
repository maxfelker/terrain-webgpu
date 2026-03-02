# Azure Infrastructure — terrain-gpu-demo

This directory contains Bicep templates that provision the Azure infrastructure for the `terrain-gpu-demo` Web App.

## Resources Created

| Resource | Name | Details |
|---|---|---|
| App Service Plan | `ASP-terrain-gpu` | B1, Linux |
| Web App | `terrain-gpu-demo` | Container-based, system-assigned managed identity |
| Role Assignment | AcrPull on `maxfelkershared` ACR | Grants the webapp's MI pull access to the ACR |

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`)
- [Bicep CLI](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/install) (installed automatically with recent `az` versions)
- Contributor access on the `maxfelker.com` resource group
- Owner / User Access Administrator access on the `shared` resource group (required to create the AcrPull role assignment)

## Deploy

```bash
az deployment group create \
  --resource-group maxfelker.com \
  --template-file .azure/main.bicep \
  --parameters .azure/main.bicepparam
```

## How Managed Identity / No-Secret Auth Works

1. The Web App is created with a **system-assigned managed identity** (MI).
2. A **AcrPull role assignment** is created on the `maxfelkershared` ACR, scoped to the webapp's MI principal ID.
3. The site config sets `acrUseManagedIdentityCreds: true`, so the App Service host authenticates to ACR using the MI token — **no registry credentials or secrets are stored anywhere**.
4. The GitHub Actions workflow (see below) pushes a new image tag to ACR and then restarts/updates the webapp; the runtime pull still uses the same MI flow.

## GitHub Actions Auto-Deploy

The workflow at `.github/workflows/deploy.yml` triggers on every push to `main`:

1. Logs in to Azure via OIDC federated credentials (no long-lived secrets).
2. Builds and pushes the Docker image to `maxfelkershared.azurecr.io/terrain-gpu:latest`.
3. Calls `az webapp restart` (or `az webapp config container set`) to pick up the new image.

The OIDC trust is established between the GitHub Actions environment and an Azure AD app registration / federated credential — no passwords or client secrets are used in CI either.
