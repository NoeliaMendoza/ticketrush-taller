param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('main', 'worker')]
    [string]$Mode
)

$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    New-Item -ItemType Directory -Path results -Force | Out-Null
    kubectl scale deployment/ticket-rush --replicas=3
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar tres replicas' }
    kubectl set env deployment/ticket-rush "CPU_MODE=$Mode" MAX_WORKERS=2
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo cambiar CPU_MODE' }
    kubectl rollout status deployment/ticket-rush --timeout=120s
    if ($LASTEXITCODE -ne 0) { throw 'El despliegue no está listo' }

    # rollout status puede terminar mientras los pods anteriores siguen cerrandose.
    $ready = $false
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        $podList = kubectl get pods -l app=ticket-rush -o json | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar los pods' }
        $pods = @($podList.items)
        $invalid = @($pods | Where-Object {
            $envMode = @($_.spec.containers[0].env | Where-Object { $_.name -eq 'CPU_MODE' })
            $_.metadata.deletionTimestamp -or $_.status.phase -ne 'Running' -or
                $envMode.Count -ne 1 -or $envMode[0].value -ne $Mode
        })
        if ($pods.Count -eq 3 -and $invalid.Count -eq 0) { $ready = $true; break }
        Write-Host 'Esperando la terminacion de pods anteriores y tres pods del modo solicitado...'
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'Persisten pods anteriores o una configuracion distinta; no se iniciara k6' }

    $consecutive = 0
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $status = Invoke-RestMethod http://localhost:30081/workers/status -DisableKeepAlive -TimeoutSec 5
            if ($status.mode -eq $Mode -and $status.maxWorkers -eq 2) { $consecutive++ }
            else { $consecutive = 0 }
        }
        catch { $consecutive = 0 }
        if ($consecutive -ge 5) { break }
        Start-Sleep -Seconds 1
    }
    if ($consecutive -lt 5) { throw 'El Service no refleja consistentemente el modo solicitado' }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $outputFile = "results/$Mode-results-$stamp.json"
    k6 run -e "EXPECTED_MODE=$Mode" "--console-output=results/$Mode-log-$stamp.txt" "--summary-export=$outputFile" tests/ping-load.js
    $testExitCode = $LASTEXITCODE
    if ($testExitCode -eq 0) { Write-Host "Prueba completada: $outputFile" }
    else { Write-Warning "Prueba fallida (exit=$testExitCode). Revisar $outputFile y el registro; no usar como comparacion valida." }
    exit $testExitCode
}
finally {
    Pop-Location
}


