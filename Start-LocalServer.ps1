param(
    [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://localhost:$Port"

function Get-ContentType([string]$Path) {
    $ext = [IO.Path]::GetExtension($Path).ToLowerInvariant()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css" { return "text/css; charset=utf-8" }
        ".js" { return "application/javascript; charset=utf-8" }
        ".mjs" { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".jpg" { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".png" { return "image/png" }
        ".svg" { return "image/svg+xml" }
        ".wasm" { return "application/wasm" }
        ".task" { return "application/octet-stream" }
        ".glb" { return "model/gltf-binary" }
        ".gltf" { return "model/gltf+json" }
        ".webmanifest" { return "application/manifest+json" }
        ".txt" { return "text/plain; charset=utf-8" }
        default { return "application/octet-stream" }
    }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "Failed to start local server on $url" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Try another port, for example: powershell -ExecutionPolicy Bypass -File .\Start-LocalServer.ps1 -Port 4174"
    exit 1
}

$chromePaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
$chrome = $null
foreach ($p in $chromePaths) {
    if (Test-Path $p) {
        $chrome = $p
        break
    }
}

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList @("--new-window", $url, "--disable-web-security", "--allow-file-access-from-files")
} else {
    Start-Process $url
}

Write-Host "=================================="
Write-Host "  Server: $url"
Write-Host "  Directory: $scriptDir"
Write-Host "  Press Ctrl+C to stop"
Write-Host "=================================="

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $resp = $ctx.Response

        try {
            $localPath = $req.Url.LocalPath
            if ($localPath -eq "/") {
                $localPath = "/index.html"
            }

            $relativePath = $localPath.TrimStart("/").Replace("/", "\")
            $filePath = Join-Path $scriptDir $relativePath

            if (-not (Test-Path $filePath -PathType Leaf)) {
                $filePath = Join-Path $scriptDir "index.html"
            }

            if (Test-Path $filePath -PathType Leaf) {
                $resp.ContentType = Get-ContentType $filePath
                $resp.Headers.Add("Access-Control-Allow-Origin", "*")
                $resp.Headers.Add("Cross-Origin-Opener-Policy", "same-origin")
                $resp.Headers.Add("Cross-Origin-Embedder-Policy", "require-corp")

                $bytes = [IO.File]::ReadAllBytes($filePath)
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $resp.StatusCode = 404
                $resp.ContentType = "text/plain; charset=utf-8"
                $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
                $resp.ContentLength64 = $msg.Length
                $resp.OutputStream.Write($msg, 0, $msg.Length)
            }
        } catch {
            if ($_.Exception.Message -notmatch "closed") {
                Write-Host "Request error: $($_.Exception.Message)" -ForegroundColor Red
            }
        } finally {
            $resp.OutputStream.Close()
        }
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
