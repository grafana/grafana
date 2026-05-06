# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# IMPORTANT: Do not invoke this file directly. Please instead run eng/common/TestResources/New-TestResources.ps1 from the repository root.

param (
  [hashtable] $AdditionalParameters = @{},
  [hashtable] $DeploymentOutputs,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string] $SubscriptionId,

  [Parameter(ParameterSetName = 'Provisioner', Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string] $TenantId,

  [Parameter()]
  [ValidatePattern('^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')]
  [string] $TestApplicationId,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string] $Environment,

  # Captures any arguments from eng/New-TestResources.ps1 not declared here (no parameter errors).
  [Parameter(ValueFromRemainingArguments = $true)]
  $RemainingArguments
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

if ($CI) {
  if (!$AdditionalParameters['deployResources']) {
    Write-Host "Skipping post-provisioning script because resources weren't deployed"
    return
  }
  az cloud set -n $Environment
  az login --federated-token $env:ARM_OIDC_TOKEN --service-principal -t $TenantId -u $TestApplicationId
  az account set --subscription $SubscriptionId
}

Write-Host "Building container"
$image = "$($DeploymentOutputs['AZIDENTITY_ACR_LOGIN_SERVER'])/azidentity-managed-id-test"
Set-Content -Path "$PSScriptRoot/Dockerfile" -Value @"
FROM mcr.microsoft.com/oss/go/microsoft/golang:latest AS builder
ENV GOARCH=amd64 GOWORK=off
COPY . /azidentity
WORKDIR /azidentity/testdata/managed-id-test
RUN go mod tidy
RUN go build -o /build/managed-id-test .
RUN GOOS=windows go build -o /build/managed-id-test.exe .

FROM mcr.microsoft.com/mirror/docker/library/alpine:3.16
RUN apk add gcompat
COPY --from=builder /build/* .
RUN chmod +x managed-id-test
CMD ["./managed-id-test"]
"@
# build from sdk/azidentity because we need that dir in the context (because the test app uses local azidentity)
docker build -t $image "$PSScriptRoot"
az acr login -n $DeploymentOutputs['AZIDENTITY_ACR_NAME']
docker push $image

$rg = $DeploymentOutputs['AZIDENTITY_RESOURCE_GROUP']

# ACI is easier to provision here than in the bicep file because the image isn't available before now
Write-Host "Deploying Azure Container Instance"
$aciName = "azidentity-test"
az container create -g $rg -n $aciName --image $image `
  --acr-identity $($DeploymentOutputs['AZIDENTITY_USER_ASSIGNED_IDENTITY']) `
  --assign-identity [system] $($DeploymentOutputs['AZIDENTITY_USER_ASSIGNED_IDENTITY']) `
  --cpu 1 `
  --ip-address Public `
  --memory 1.0 `
  --os-type Linux `
  --role "Storage Blob Data Reader" `
  --scope $($DeploymentOutputs['AZIDENTITY_STORAGE_ID']) `
  -e AZIDENTITY_STORAGE_NAME=$($DeploymentOutputs['AZIDENTITY_STORAGE_NAME']) `
  AZIDENTITY_STORAGE_NAME_USER_ASSIGNED=$($DeploymentOutputs['AZIDENTITY_STORAGE_NAME_USER_ASSIGNED']) `
  AZIDENTITY_USER_ASSIGNED_IDENTITY=$($DeploymentOutputs['AZIDENTITY_USER_ASSIGNED_IDENTITY']) `
  AZIDENTITY_USER_ASSIGNED_IDENTITY_CLIENT_ID=$($DeploymentOutputs['AZIDENTITY_USER_ASSIGNED_IDENTITY_CLIENT_ID']) `
  AZIDENTITY_USER_ASSIGNED_IDENTITY_OBJECT_ID=$($DeploymentOutputs['AZIDENTITY_USER_ASSIGNED_IDENTITY_OBJECT_ID']) `
  FUNCTIONS_CUSTOMHANDLER_PORT=80
$aciIP = az container show -g $rg -n $aciName --query ipAddress.ip --output tsv
Write-Host "##vso[task.setvariable variable=AZIDENTITY_ACI_IP;]$aciIP"

# Azure Functions deployment: copy the Windows binary from the Docker image, deploy it in a zip
Write-Host "Deploying to Azure Functions"
$container = docker create $image
docker cp ${container}:managed-id-test.exe "$PSScriptRoot/testdata/managed-id-test/"
docker rm -v $container
Compress-Archive -Path "$PSScriptRoot/testdata/managed-id-test/*" -DestinationPath func.zip -Force
az functionapp deploy -g $rg -n $DeploymentOutputs['AZIDENTITY_FUNCTION_NAME'] --src-path func.zip --type zip

Write-Host "Creating federated identity"
$aksName = $DeploymentOutputs['AZIDENTITY_AKS_NAME']
$idName = $DeploymentOutputs['AZIDENTITY_USER_ASSIGNED_IDENTITY_NAME']
$issuer = az aks show -g $rg -n $aksName --query "oidcIssuerProfile.issuerUrl" -otsv
$podName = "azidentity-test"
$serviceAccountName = "workload-identity-sa"
az identity federated-credential create -g $rg --identity-name $idName --issuer $issuer --name $idName --subject system:serviceaccount:default:$serviceAccountName
Write-Host "Deploying to AKS"
az aks get-credentials -g $rg -n $aksName
az aks update --attach-acr $DeploymentOutputs['AZIDENTITY_ACR_NAME'] -g $rg -n $aksName
Set-Content -Path "$PSScriptRoot/k8s.yaml" -Value @"
apiVersion: v1
kind: ServiceAccount
metadata:
  annotations:
    azure.workload.identity/client-id: $($DeploymentOutputs['AZIDENTITY_USER_ASSIGNED_IDENTITY_CLIENT_ID'])
  name: $serviceAccountName
  namespace: default
---
apiVersion: v1
kind: Pod
metadata:
  name: $podName
  namespace: default
  labels:
    app: $podName
    azure.workload.identity/use: "true"
spec:
  serviceAccountName: $serviceAccountName
  containers:
  - name: $podName
    image: $image
    env:
    - name: AZIDENTITY_STORAGE_NAME
      value: $($DeploymentOutputs['AZIDENTITY_STORAGE_NAME_USER_ASSIGNED'])
    - name: AZIDENTITY_USE_WORKLOAD_IDENTITY
      value: "true"
    - name: FUNCTIONS_CUSTOMHANDLER_PORT
      value: "80"
  nodeSelector:
    kubernetes.io/os: linux
"@
kubectl apply -f "$PSScriptRoot/k8s.yaml"
Write-Host "##vso[task.setvariable variable=AZIDENTITY_POD_NAME;]$podName"
