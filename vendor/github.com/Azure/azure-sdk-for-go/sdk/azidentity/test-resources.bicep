// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

@description('Kubernetes cluster admin user name.')
param adminUser string = 'azureuser'

@minLength(6)
@maxLength(23)
@description('The base resource name.')
param baseName string = resourceGroup().name

@description('Whether to deploy resources. When set to false, this file deploys nothing.')
param deployResources bool = false

param sshPubKey string = ''

@description('The location of the resource. By default, this is the same as the resource group.')
param location string = resourceGroup().location

// https://learn.microsoft.com/azure/role-based-access-control/built-in-roles
var acrPull = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var blobReader = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
)

resource sa 'Microsoft.Storage/storageAccounts@2021-08-01' = if (deployResources) {
  kind: 'StorageV2'
  location: location
  name: 'sa${uniqueString(baseName)}'
  properties: {
    accessTier: 'Hot'
  }
  sku: {
    name: 'Standard_LRS'
  }
}

resource saUserAssigned 'Microsoft.Storage/storageAccounts@2021-08-01' = if (deployResources) {
  kind: 'StorageV2'
  location: location
  name: 'sa2${uniqueString(baseName)}'
  properties: {
    accessTier: 'Hot'
  }
  sku: {
    name: 'Standard_LRS'
  }
}

resource usermgdid 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = if (deployResources) {
  location: location
  name: baseName
}

resource acrPullContainerInstance 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployResources) {
  name: guid(resourceGroup().id, acrPull, 'containerInstance')
  properties: {
    principalId: deployResources ? usermgdid.properties.principalId : ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPull
  }
  scope: containerRegistry
}

resource acrPullVM 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployResources) {
  name: guid(resourceGroup().id, acrPull, 'vm')
  properties: {
    principalId: deployResources ? vm.identity.principalId : ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPull
  }
  scope: containerRegistry
}

resource blobRoleUserAssigned 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployResources) {
  scope: saUserAssigned
  name: guid(resourceGroup().id, blobReader, usermgdid.id)
  properties: {
    principalId: deployResources ? usermgdid.properties.principalId : ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobReader
  }
}

resource blobRoleFunc 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployResources) {
  name: guid(resourceGroup().id, blobReader, 'azfunc')
  properties: {
    principalId: deployResources ? azfunc.identity.principalId : ''
    roleDefinitionId: blobReader
    principalType: 'ServicePrincipal'
  }
  scope: sa
}

resource blobRoleVM 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployResources) {
  scope: sa
  name: guid(resourceGroup().id, blobReader, 'vm')
  properties: {
    principalId: deployResources ? vm.identity.principalId : ''
    roleDefinitionId: blobReader
    principalType: 'ServicePrincipal'
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = if (deployResources) {
  location: location
  name: uniqueString(resourceGroup().id)
  properties: {
    adminUserEnabled: true
  }
  sku: {
    name: 'Basic'
  }
}

resource farm 'Microsoft.Web/serverfarms@2021-03-01' = if (deployResources) {
  kind: 'app'
  location: location
  name: '${baseName}_asp'
  properties: {}
  sku: {
    capacity: 1
    family: 'B'
    name: 'B1'
    size: 'B1'
    tier: 'Basic'
  }
}

resource azfunc 'Microsoft.Web/sites@2021-03-01' = if (deployResources) {
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${deployResources ? usermgdid.id : ''}': {}
    }
  }
  kind: 'functionapp'
  location: location
  name: '${baseName}func'
  properties: {
    enabled: true
    httpsOnly: true
    keyVaultReferenceIdentity: 'SystemAssigned'
    serverFarmId: farm.id
    siteConfig: {
      alwaysOn: true
      appSettings: [
        {
          name: 'AZIDENTITY_STORAGE_NAME'
          value: deployResources ? sa.name : null
        }
        {
          name: 'AZIDENTITY_STORAGE_NAME_USER_ASSIGNED'
          value: deployResources ? saUserAssigned.name : null
        }
        {
          name: 'AZIDENTITY_USER_ASSIGNED_IDENTITY'
          value: deployResources ? usermgdid.id : null
        }
        {
          name: 'AZIDENTITY_USER_ASSIGNED_IDENTITY_CLIENT_ID'
          value: deployResources ? usermgdid.properties.clientId : null
        }
        {
          name: 'AZIDENTITY_USER_ASSIGNED_IDENTITY_OBJECT_ID'
          value: deployResources ? usermgdid.properties.principalId : null
        }
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${deployResources ? sa.name : ''};EndpointSuffix=${deployResources ? environment().suffixes.storage : ''};AccountKey=${deployResources ? sa.listKeys().keys[0].value : ''}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'custom'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${deployResources ? sa.name : ''};EndpointSuffix=${deployResources ? environment().suffixes.storage : ''};AccountKey=${deployResources ? sa.listKeys().keys[0].value : ''}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower('${baseName}-func')
        }
      ]
      http20Enabled: true
      minTlsVersion: '1.2'
    }
  }
}

resource aks 'Microsoft.ContainerService/managedClusters@2023-06-01' = if (deployResources) {
  name: baseName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    agentPoolProfiles: [
      {
        count: 1
        enableAutoScaling: false
        kubeletDiskType: 'OS'
        mode: 'System'
        name: 'agentpool'
        osDiskSizeGB: 128
        osDiskType: 'Managed'
        osSKU: 'Ubuntu'
        osType: 'Linux'
        type: 'VirtualMachineScaleSets'
        vmSize: 'Standard_D2s_v3'
      }
    ]
    dnsPrefix: 'identitytest'
    enableRBAC: true
    linuxProfile: {
      adminUsername: adminUser
      ssh: {
        publicKeys: [
          {
            keyData: sshPubKey
          }
        ]
      }
    }
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
  }
}

resource publicIP 'Microsoft.Network/publicIPAddresses@2023-05-01' = if (deployResources) {
  name: '${baseName}PublicIP'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
  }
}

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-07-01' = if (deployResources) {
  name: '${baseName}NSG'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTP'
        properties: {
          description: 'Allow HTTP traffic on port 80'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 1000
          direction: 'Inbound'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-07-01' = if (deployResources) {
  name: '${baseName}vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
    subnets: [
      {
        name: '${baseName}subnet'
        properties: {
          addressPrefix: '10.0.0.0/24'
          defaultOutboundAccess: false
          networkSecurityGroup: {
            id: deployResources ? nsg.id : ''
          }
        }
      }
    ]
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2024-07-01' = if (deployResources) {
  name: '${baseName}NIC'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'myIPConfig'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: deployResources ? publicIP.id : ''
          }
          subnet: {
            id: deployResources ? vnet.properties.subnets[0].id : ''
          }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = if (deployResources) {
  name: '${baseName}vm'
  location: location
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${deployResources ? usermgdid.id: ''}': {}
    }
  }
  properties: {
    hardwareProfile: {
      vmSize: 'Standard_DS1_v2'
    }
    osProfile: {
      adminUsername: adminUser
      computerName: '${baseName}vm'
      customData: base64('''
#cloud-config
package_update: true
packages:
  - docker.io
runcmd:
  - curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
  - az login --identity --allow-no-subscriptions
''')
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUser}/.ssh/authorized_keys'
              keyData: sshPubKey
            }
          ]
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: deployResources ? nic.id : ''
        }
      ]
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
      }
    }
  }
}

output AZIDENTITY_ACR_LOGIN_SERVER string = deployResources ? containerRegistry.properties.loginServer : ''
output AZIDENTITY_ACR_NAME string = deployResources ? containerRegistry.name : ''
output AZIDENTITY_AKS_NAME string = deployResources ? aks.name : ''
output AZIDENTITY_FUNCTION_NAME string = deployResources ? azfunc.name : ''
output AZIDENTITY_STORAGE_ID string = deployResources ? sa.id : ''
output AZIDENTITY_STORAGE_NAME string = deployResources ? sa.name : ''
output AZIDENTITY_STORAGE_NAME_USER_ASSIGNED string = deployResources ? saUserAssigned.name : ''
output AZIDENTITY_USER_ASSIGNED_IDENTITY string = deployResources ? usermgdid.id : ''
output AZIDENTITY_USER_ASSIGNED_IDENTITY_CLIENT_ID string = deployResources ? usermgdid.properties.clientId : ''
output AZIDENTITY_USER_ASSIGNED_IDENTITY_NAME string = deployResources ? usermgdid.name : ''
output AZIDENTITY_USER_ASSIGNED_IDENTITY_OBJECT_ID string = deployResources ? usermgdid.properties.principalId : ''
output AZIDENTITY_VM_NAME string = deployResources ? vm.name : ''
output AZIDENTITY_VM_IP string = deployResources ? publicIP.properties.ipAddress : ''
