param([ValidateRange(1,10)][int]$Repetitions=3)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'wait-ticket-rush.ps1')
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $runDir='results/worker-pool-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    kubectl scale deployment/ticket-rush --replicas=3
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo escalar' }
    for ($repeat=1; $repeat -le $Repetitions; $repeat++) {
        foreach ($limit in @(1,2,4,8)) {
            kubectl set env deployment/ticket-rush CPU_MODE=worker "MAX_WORKERS=$limit"
            if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar el modo' }
            kubectl rollout status deployment/ticket-rush --timeout=180s
            if ($LASTEXITCODE -ne 0) { throw 'Rollout fallido' }
            Wait-TicketRushMode -Mode worker -Limit $limit
            $prefix="$runDir/workers-$limit-repeat-$repeat"
            kubectl get pods -l app=ticket-rush -o json | Out-File -Encoding UTF8 "$prefix-pods.json"
            $clock=[Diagnostics.Stopwatch]::StartNew()
            k6 run -e EXPECTED_MODE=worker "--summary-export=$prefix.json" "--console-output=$prefix-log.txt" tests/ping-load.js
            $code=$LASTEXITCODE
            $clock.Stop()
            @{ maxWorkers=$limit; repetition=$repeat; replicas=3; mode='worker'; hashIterations=200000;
               wallSeconds=$clock.Elapsed.TotalSeconds; exitCode=$code; finished=(Get-Date -Format o) } |
                ConvertTo-Json | Out-File -Encoding UTF8 "$prefix-meta.json"
            if ($code -ne 0) { Write-Warning "Corrida fallida: $prefix" }
        }
    }
    node tests/summarize-worker-pool.cjs $runDir
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar la tabla' }
    Write-Host "Resultados: $runDir"
}
finally { Pop-Location }

