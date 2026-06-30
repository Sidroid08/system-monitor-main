$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:9201/")
$listener.Start()
Write-Host "Host Agent listening on 9201..."

while ($true) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    if ($request.Url.AbsolutePath -eq "/api/processes") {
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.ContentType = "application/json"
        
        $psCmd = "Get-Process | Select-Object Name, Id, WorkingSet64, CPU, StartTime, MainWindowTitle | ConvertTo-Json -Compress"
        $json = Invoke-Expression $psCmd
        
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.Close()
}
