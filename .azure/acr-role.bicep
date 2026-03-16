@description('Name of the Azure Container Registry')
param acrName string

@description('Principal ID of the managed identity to assign the role to')
param principalId string

@description('Role definition ID (e.g. AcrPull: 7f951dda-4ed3-4680-a7ca-43fe172d538d)')
param roleDefinitionId string

@description('Resource ID of the web app (used for unique role assignment name)')
param webAppId string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webAppId, roleDefinitionId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
