# ===============================
# 🚀 API Test Runner (Final Version)
# ===============================

param (
    [string]$ConfigPath = ".\tests.config.json",
    [string]$Base = "http://localhost:3000",
    [switch]$Verbose
)

Write-Host "==============================="
Write-Host "Starting API Test Runner..."

# Load config
$config = Get-Content $ConfigPath | ConvertFrom-Json

$reportObj = @()

foreach ($item in $config.endpoints) {
    $endpointReport = @{
        Endpoint = $item.path
        Create   = $null
        GetList  = $null
        GetItem  = $null
        Update   = $null
        Delete   = $null
    }

    $endpointUrl = "$Base$($item.path)"

    # --------------------------
    # CREATE
    # --------------------------
    if ($item.createPayload -ne $null) {
        try {
            $createPayload = $item.createPayload | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri $endpointUrl -Method POST -Body $createPayload -ContentType "application/json"
            $endpointReport.Create = @{
                Status = "OK"
                HTTPStatus = 201
                Response = $response
            }
            Write-Host "[CREATE] $endpointUrl -> 201"
        } catch {
            $endpointReport.Create = @{
                Status = "ERROR"
                HTTPStatus = $_.Exception.Response.StatusCode.Value__
                ErrorMessage = $_.Exception.Message
                Response = $null
            }
            Write-Host "[CREATE ERROR] $($_.Exception.Message)"
        }
    }

    # --------------------------
    # GET LIST
    # --------------------------
    $itemIds = @()
    try {
        $listResponse = Invoke-RestMethod -Uri $endpointUrl -Method GET
        $endpointReport.GetList = @{
            Status = "OK"
            HTTPStatus = 200
            Response = $listResponse
        }

        # محاولة استخراج معرفات للأغراض اللاحقة
        if ($listResponse -is [System.Collections.IEnumerable]) {
            foreach ($obj in $listResponse) {
                if ($obj.PSObject.Properties.Name -contains "id") { $itemIds += $obj.id }
                elseif ($obj.PSObject.Properties.Name -contains "driverid") { $itemIds += $obj.driverid }
                elseif ($obj.PSObject.Properties.Name -contains "customerid") { $itemIds += $obj.customerid }
                elseif ($obj.PSObject.Properties.Name -contains "storeid") { $itemIds += $obj.storeid }
                elseif ($obj.PSObject.Properties.Name -contains "productid") { $itemIds += $obj.productid }
                elseif ($obj.PSObject.Properties.Name -contains "orderid") { $itemIds += $obj.orderid }
            }
        }

        Write-Host "[GET LIST] $endpointUrl -> 200"
    } catch {
        $endpointReport.GetList = @{
            Status = "ERROR"
            HTTPStatus = $_.Exception.Response.StatusCode.Value__
            ErrorMessage = $_.Exception.Message
            Response = $null
        }
        Write-Host "[GET LIST ERROR] $($_.Exception.Message)"
    }

    # --------------------------
    # GET ITEM
    # --------------------------
    if ($item.getItemPath -and $itemIds.Count -gt 0) {
        try {
            $firstId = $itemIds[0]
            $getItemUrl = "$Base$($item.getItemPath.Replace(':id',$firstId))"
            $itemResponse = Invoke-RestMethod -Uri $getItemUrl -Method GET
            $endpointReport.GetItem = @{
                Status = "OK"
                HTTPStatus = 200
                Response = $itemResponse
            }
            Write-Host "[GET ITEM] $getItemUrl -> 200"
        } catch {
            $endpointReport.GetItem = @{
                Status = "ERROR"
                HTTPStatus = $_.Exception.Response.StatusCode.Value__
                ErrorMessage = $_.Exception.Message
                Response = $null
            }
            Write-Host "[GET ITEM ERROR] $($_.Exception.Message)"
        }
    }

    # --------------------------
    # UPDATE
    # --------------------------
    if ($item.updatePayload -and $itemIds.Count -gt 0 -and $item.getItemPath) {
        try {
            $updateMethod = if ($item.updateMethod) { $item.updateMethod.ToString().ToUpper() } else { "PUT" }
            $updateUrl = "$Base$($item.getItemPath.Replace(':id',$itemIds[0]))"
            $updatePayload = $item.updatePayload | ConvertTo-Json -Depth 10
            Invoke-RestMethod -Uri $updateUrl -Method $updateMethod -Body $updatePayload -ContentType "application/json"
            $endpointReport.Update = @{
                Status = "OK"
                HTTPStatus = 200
            }
            Write-Host "[UPDATE] $updateUrl -> 200"
        } catch {
            $endpointReport.Update = @{
                Status = "ERROR"
                ErrorMessage = $_.Exception.Message
            }
            Write-Host "[UPDATE ERROR] $($_.Exception.Message)"
        }
    }

    # --------------------------
    # DELETE
    # --------------------------
    if ($item.getItemPath -and $itemIds.Count -gt 0) {
        try {
            $deleteUrl = "$Base$($item.getItemPath.Replace(':id',$itemIds[0]))"
            Invoke-RestMethod -Uri $deleteUrl -Method DELETE
            $endpointReport.Delete = @{
                Status = "OK"
                HTTPStatus = 200
            }
            Write-Host "[DELETE] $deleteUrl -> 200"
        } catch {
            $endpointReport.Delete = @{
                Status = "ERROR"
                ErrorMessage = $_.Exception.Message
            }
            Write-Host "[DELETE ERROR] $($_.Exception.Message)"
        }
    }

    $reportObj += $endpointReport
}

# --------------------------
# Save full report safely
# --------------------------
$reportJson = $reportObj | ConvertTo-Json -Depth 10 -Compress
$reportJson | Out-File -FilePath "api-test-report.json" -Encoding UTF8

Write-Host "Full detailed report saved to api-test-report.json"
Write-Host "=== ✅ API Test Completed ==="
