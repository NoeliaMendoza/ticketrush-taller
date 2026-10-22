param(
    [int]$Seconds = 60,
    [string]$OutputFile = ('results/workers-live-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.jsonl')
)
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $parentDir = Split-Path -Parent $OutputFile
    if ($parentDir) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
    $podList = kubectl get pods -l app=ticket-rush -o json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $podList.items.Count -ne 3) { throw 'Se requieren tres pods de TicketRush' }
    $pods = @($podList.items | ForEach-Object { $_.metadata.name })
    $until = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $until) {
        foreach ($pod in $pods) {
            $timestamp = Get-Date -Format o
            try {
                $raw = kubectl exec $pod -- node -e 'fetch(''http://localhost:3000/workers/status'').then(r=>r.json()).then(d=>console.log(JSON.stringify(d))).catch(()=>process.exit(1))'
                if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el pod' }
                $sample = $raw | ConvertFrom-Json
                $sample | Add-Member -NotePropertyName timestamp -NotePropertyValue $timestamp
                $sample | ConvertTo-Json -Compress | Add-Content -Encoding UTF8 $OutputFile
                Write-Host "$timestamp | $pod | limite=$($sample.maxWorkers) activos=$($sample.activeWorkers) cola=$($sample.queuedTasks)"
                if ($sample.activeWorkers -gt $sample.maxWorkers) { Write-Warning 'Se observo un exceso del limite' }
            }
            catch {
                @{ timestamp = $timestamp; hostname = $pod; error = $_.Exception.Message } |
                    ConvertTo-Json -Compress | Add-Content -Encoding UTF8 $OutputFile
                Write-Warning "${pod}: $_"
            }
        }
        Start-Sleep -Milliseconds 250
    }
    Write-Host "Muestras guardadas en $OutputFile"
}
finally { Pop-Location }
