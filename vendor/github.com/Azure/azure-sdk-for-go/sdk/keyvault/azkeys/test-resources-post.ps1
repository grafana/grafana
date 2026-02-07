# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# IMPORTANT: Do not invoke this file directly. Please instead run eng/New-TestResources.ps1 from the repository root.

#Requires -Version 6.0
#Requires -PSEdition Core

using namespace System.Security.Cryptography
using namespace System.Security.Cryptography.X509Certificates

# Use same parameter names as declared in eng/New-TestResources.ps1 (assume validation therein).
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param (
    [Parameter()]
    [hashtable] $DeploymentOutputs,

    # Captures any arguments from eng/New-TestResources.ps1 not declared here (no parameter errors).
    [Parameter(ValueFromRemainingArguments = $true)]
    $RemainingArguments
)

# By default stop for any error.
if (!$PSBoundParameters.ContainsKey('ErrorAction')) {
    $ErrorActionPreference = 'Stop'
}

function Log($Message) {
    Write-Host ('{0} - {1}' -f [DateTime]::Now.ToLongTimeString(), $Message)
}

function New-X509Certificate2([string] $SubjectName) {

    $rsa = [RSA]::Create(2048)
    try {
        $req = [CertificateRequest]::new(
            [string] $SubjectName,
            $rsa,
            [HashAlgorithmName]::SHA256,
            [RSASignaturePadding]::Pkcs1
        )

        # TODO: Add any KUs necessary to $req.CertificateExtensions

        $NotBefore = [DateTimeOffset]::Now.AddDays(-1)
        $NotAfter = $NotBefore.AddDays(365)

        $req.CreateSelfSigned($NotBefore, $NotAfter)
    }
    finally {
        $rsa.Dispose()
    }
}

function Export-X509Certificate2([string] $Path, [X509Certificate2] $Certificate) {

    $Certificate.Export([X509ContentType]::Pfx) | Set-Content $Path -AsByteStream
}

function Export-X509Certificate2PEM([string] $Path, [X509Certificate2] $Certificate) {

@"
-----BEGIN CERTIFICATE-----
$([Convert]::ToBase64String($Certificate.RawData, 'InsertLineBreaks'))
-----END CERTIFICATE-----
"@ > $Path

}

# Make sure we deployed a Managed HSM.
if (!$DeploymentOutputs['AZURE_MANAGEDHSM_URL']) {
    Log "Managed HSM not deployed; skipping activation"
    exit
}

[Uri] $hsmUrl = $DeploymentOutputs['AZURE_MANAGEDHSM_URL']
$hsmName = $hsmUrl.Host.Substring(0, $hsmUrl.Host.IndexOf('.'))

Log 'Creating 3 X509 certificates to activate security domain'
$wrappingFiles = foreach ($i in 0..2) {
    $certificate = New-X509Certificate2 "CN=$($hsmUrl.Host)"

    $baseName = "$PSScriptRoot\$hsmName-certificate$i"
    Export-X509Certificate2 "$baseName.pfx" $certificate
    Export-X509Certificate2PEM "$baseName.cer" $certificate

    Resolve-Path "$baseName.cer"
}

Log "Downloading security domain from '$hsmUrl'"

$sdPath = "$PSScriptRoot\$hsmName-security-domain.key"
if (Test-Path $sdpath) {
    Log "Deleting old security domain: $sdPath"
    Remove-Item $sdPath -Force
}

Export-AzKeyVaultSecurityDomain -Name $hsmName -Quorum 2 -Certificates $wrappingFiles -OutputPath $sdPath -ErrorAction SilentlyContinue -Verbose
if ( !$? ) {
    Write-Host $Error[0].Exception
    Write-Error $Error[0]

    exit
}

Log "Security domain downloaded to '$sdPath'; Managed HSM is now active at '$hsmUrl'"

# Force a sleep to wait for Managed HSM activation to propagate through Cosmos replication. Issue tracked in Azure DevOps.
Log 'Sleeping for 30 seconds to allow activation to propagate...'
Start-Sleep -Seconds 30

$testApplicationOid = $DeploymentOutputs['CLIENT_OBJECTID']

Log "Creating additional required role assignments for '$testApplicationOid'"
$null = New-AzKeyVaultRoleAssignment -HsmName $hsmName -RoleDefinitionName 'Managed HSM Crypto Officer' -ObjectID $testApplicationOid
$null = New-AzKeyVaultRoleAssignment -HsmName $hsmName -RoleDefinitionName 'Managed HSM Crypto User' -ObjectID $testApplicationOid

Log "Role assignments created for '$testApplicationOid'"