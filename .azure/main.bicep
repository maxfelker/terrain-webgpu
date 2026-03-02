@description('Azure region for all resources')
param location string = 'eastus'

@description('Name of the App Service Plan')
param appServicePlanName string = 'ASP-terrain-gpu'

@description('Name of the Web App')
param webAppName string = 'terrain-gpu-demo'

@description('Container image to deploy')
param containerImage string = 'maxfelkershared.azurecr.io/terrain-gpu:latest'

@description('Name of the Azure Container Registry')
param acrName string = 'maxfelkershared'

@description('Resource group containing the Azure Container Registry')
param acrResourceGroup string = 'shared'

// AcrPull built-in role definition ID
var acrPullRoleDefinitionId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
  scope: resourceGroup(acrResourceGroup)
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: webAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      acrUseManagedIdentityCreds: true
      appSettings: [
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'PORT'
          value: '80'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://maxfelkershared.azurecr.io'
        }
      ]
    }
    httpsOnly: true
  }
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webApp.id, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output managedIdentityPrincipalId string = webApp.identity.principalId
