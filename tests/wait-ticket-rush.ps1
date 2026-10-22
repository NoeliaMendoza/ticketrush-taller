function Wait-TicketRushMode {
    param([string]$Mode, [int]$Limit)
    for ($attempt=1; $attempt -le 60; $attempt++) {
        $data=kubectl get pods -l app=ticket-rush -o json | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar los pods' }
        $pods=@($data.items)
        $invalid=@($pods | Where-Object {
            $vars=@{}
            foreach ($item in $_.spec.containers[0].env) { $vars[$item.name]=$item.value }
            $_.metadata.deletionTimestamp -or $_.status.phase -ne 'Running' -or
                $vars['CPU_MODE'] -ne $Mode -or $vars['MAX_WORKERS'] -ne "$Limit"
        })
        if ($pods.Count -eq 3 -and $invalid.Count -eq 0) {
            $matches=0
            foreach ($i in 1..5) {
                try {
                    $s=Invoke-RestMethod http://localhost:30081/workers/status -DisableKeepAlive -TimeoutSec 5
                    if ($s.mode -eq $Mode -and $s.maxWorkers -eq $Limit) { $matches++ }
                } catch { }
            }
            if ($matches -eq 5) { return }
        }
        Write-Host "Esperando tres pods $Mode con limite $Limit y salida de pods anteriores..."
        Start-Sleep -Seconds 2
    }
    throw 'La configuracion no se estabilizo; se cancela la medicion'
}
