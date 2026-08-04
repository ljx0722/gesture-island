# 粒子交互AI教学 - 本地HTTP服务器启动脚本
# 自动选择未被占用的端口，打开Chrome浏览器

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 检测可用端口
function Get-AvailablePort {
    $ports = @(4173, 5173, 8080, 3000, 3001, 4000, 5000, 8000, 8888, 9000)
    foreach ($port in $ports) {
        $inUse = netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING"
        if (-not $inUse) { return $port }
    }
    # 如果都占用，随机找一个
    $randomPort = Get-Random -Minimum 9001 -Maximum 65000
    return $randomPort
}

$port = Get-AvailablePort
$url = "http://localhost:$port"

Write-Host ""
Write-Host "  [36m端口: $port[0m"
Write-Host "  [36m地址: $url[0m"
Write-Host ""

# 启动Python HTTP服务器（如果可用）
$pythonCmd = $null
if (Get-Command python3 -ErrorAction SilentlyContinue) { $pythonCmd = "python3" }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $pythonCmd = "python" }

if ($pythonCmd) {
    Write-Host "  使用 $pythonCmd 启动HTTP服务器..."
    $serverProcess = Start-Process -FilePath $pythonCmd -ArgumentList "-m", "http.server", $port, "--directory", $scriptDir -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 1
} else {
    # 使用PowerShell内置HTTP监听器（备用方案）
    Write-Host "  Python不可用，使用PowerShell HTTP服务器..."

    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://+:$port/")
    $listener.Start()

    $serverJob = Start-Job -ScriptBlock {
        param($scriptDir, $port)
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://+:$port/")
        $listener.Start()
        $mimeTypes = @{
            ".html" = "text/html; charset=utf-8"
            ".css"  = "text/css; charset=utf-8"
            ".js"   = "application/javascript; charset=utf-8"
            ".mjs"  = "application/javascript; charset=utf-8"
            ".json" = "application/json; charset=utf-8"
            ".jpg"  = "image/jpeg"
            ".jpeg" = "image/jpeg"
            ".png"  = "image/png"
            ".svg"  = "image/svg+xml"
            ".wasm" = "application/wasm"
            ".task" = "application/octet-stream"
            ".glb"  = "model/gltf-binary"
            ".gltf" = "model/gltf+json"
            ".ico"  = "image/x-icon"
            ".webmanifest" = "application/manifest+json"
        }

        while ($listener.IsListening) {
            try {
                $context = $listener.GetContext()
                $request = $context.Request
                $response = $context.Response

                $localPath = $request.Url.LocalPath
                if ($localPath -eq "/") { $localPath = "/index.html" }

                $filePath = Join-Path $scriptDir $localPath.TrimStart("/").Replace("/", "\")

                if (Test-Path $filePath -PathType Leaf) {
                    $ext = [IO.Path]::GetExtension($filePath).ToLower()
                    $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

                    $response.ContentType = $contentType
                    $response.Headers.Add("Access-Control-Allow-Origin", "*")
                    $response.Headers.Add("Cross-Origin-Opener-Policy", "same-origin")
                    $response.Headers.Add("Cross-Origin-Embedder-Policy", "require-corp")

                    $bytes = [IO.File]::ReadAllBytes($filePath)
                    $response.ContentLength64 = $bytes.Length
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                } else {
                    $response.StatusCode = 404
                }
                $response.OutputStream.Close()
            } catch { }
        }
    } -ArgumentList $scriptDir, $port

    Start-Sleep -Seconds 1
}

# 打开Chrome浏览器
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)

$chrome = $null
foreach ($p in $chromePaths) {
    if (Test-Path $p) { $chrome = $p; break }
}

if ($chrome) {
    Write-Host "  正在打开 Chrome 浏览器..."
    Start-Process -FilePath $chrome -ArgumentList "--new-window", $url, "--disable-web-security", "--disable-features=IsolateOrigins,site-per-process", "--allow-file-access-from-files"
} elseif (Get-Command start -ErrorAction SilentlyContinue) {
    Write-Host "  正在打开默认浏览器..."
    Start-Process $url
}

Write-Host ""
Write-Host "  [32m服务器已启动！[0m"
Write-Host "  按 Ctrl+C 停止服务器"
Write-Host ""

# 保持运行
try {
    while ($true) { Start-Sleep -Seconds 10 }
} finally {
    if ($serverProcess) { Stop-Process $serverProcess -Force }
    if ($serverJob) { Stop-Job $serverJob; Remove-Job $serverJob }
    if ($listener) { $listener.Stop() }
}
