using './main.bicep'

param location = 'eastus'
param appServicePlanName = 'ASP-terrain-gpu'
param webAppName = 'terrain-gpu-demo'
param containerImage = 'maxfelkershared.azurecr.io/terrain-gpu:latest'
param acrName = 'maxfelkershared'
param acrResourceGroup = 'shared'
