# run-api-tests-prof.ps1 (محدث)

param(
    [string]$ConfigPath = ".\tests.config.json",
    [string]$Base = "http://localhost:3000",
    [switch]$Verbose
)

# تحميل الإعدادات
$config = Get-Content $ConfigPath | ConvertFrom-Json
$reportObj = @()

function Get-RandomPhone {
    return "05$([int](Get-Random -Minimum 1000000 -Maximum 9999999))"
}

function Get-RandomEmail($prefix) {
    return "$prefix$([int](Get-Random -Minimum 1000 -Maximum 9999))@example.com"
}

foreach ($item in $config.endpoints) {
    $path = $item.path
    Write-Host "`n==============================="
    Write-Host "Testing: $path"

    # توليد بيانات CREATE عشوائية إذا كانت تحتوي phone/email
    $createPayload = $item.createPayload
    if ($createPayload.PSObject.Properties.Name -contains "phone") {
        $createPayload.phone = Get-RandomPhone
    }
    if ($createPayload.PSObject.Properties.Name -contains "email") {
        $createPayload.email = Get-RandomEmail ($createPayload.fullname -replace ' ', '').ToLower())
    }

    try {
        # CREATE
        $responseCreate = Invoke-RestMethod -Uri "$Base$path" -Method POST -Body ($createPayload | ConvertTo-Json -Depth 10) -ContentType "application/json"
        Write-Host "[CREATE] $Base$path -> $($responseCreate | ConvertTo-Json -Depth 10)"
    } catch {
        Write-Host "[CREATE ERROR] $_"
    }

    # GET LIST
    try {
        $responseList = Invoke-RestMethod -Uri "$Base$path" -Method GET
        Write-Host "[GET LIST] $Base$path -> $($responseList | ConvertTo-Json -Depth 10)"
    } catch {
        Write-Host "[GET LIST ERROR] $_"
    }

    # UPDATE إذا موجود updatePayload
    if ($item.updatePayload) {
        $id = $responseCreate.$($item.idFieldCandidates[0])
        if ($id) {
            $getItemPath = $item.getItemPath -replace ":id", $id
            $method = if ($item.updateMethod) { $item.updateMethod.ToString().ToUpper() } else { 'PUT' }

            try {
                $responseUpdate = Invoke-RestMethod -Uri "$Base$getItemPath" -Method $method -Body ($item.updatePayload | ConvertTo-Json -Depth 10) -ContentType "application/json"
                Write-Host "[UPDATE] $Base$getItemPath -> $($responseUpdate | ConvertTo-Json -Depth 10)"
            } catch {
                Write-Host "[UPDATE ERROR] $_"
            }

            # DELETE
            try {
                $responseDelete = Invoke-RestMethod -Uri "$Base$getItemPath" -Method DELETE
                Write-Host "[DELETE] $Base$getItemPath -> $($responseDelete | ConvertTo-Json -Depth 10)"
            } catch {
                Write-Host "[DELETE ERROR] $_"
            }
        }
    }

    $reportObj += [PSCustomObject]@{
        Endpoint = $path
        Create = $responseCreate
        List = $responseList
        Timestamp = (Get-Date)
    }
}

# حفظ التقرير مع إزالة أي مفاتيح مكررة
$reportObj | Select-Object -Property * -Unique | ConvertTo-Json -Depth 10 | Out-File -FilePath api-test-report.json
Write-Host "`nFull report saved to api-test-report.json"
