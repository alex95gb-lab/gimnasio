# =============================================================
#  Servidor local para probar la app en este PC (solo pruebas).
#
#  NO lo abras con "Ejecutar con PowerShell": la politica de
#  ejecucion de Windows lo bloquea y la ventana se cierra sola.
#  Usa "abrir-servidor.bat" (doble clic), que ya lo arranca bien.
#
#  Parar: Ctrl + C en la ventana.
# =============================================================
param([int]$Puerto = 8080)

# Si algo falla, deja el error a la vista en vez de cerrar la ventana.
trap {
  Write-Host ""
  Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
  Read-Host "Pulsa Enter para cerrar"
  exit 1
}

$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path

$mime = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".js"="application/javascript; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".webmanifest"="application/manifest+json; charset=utf-8"; ".png"="image/png";
  ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".txt"="text/plain; charset=utf-8";
  ".md"="text/plain; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$enRed = $true
try {
  $listener.Prefixes.Add("http://+:$Puerto/")
  $listener.Start()
} catch {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$Puerto/")
  $listener.Start()
  $enRed = $false
}

$ips = @()
try {
  $ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -ExpandProperty IPAddress
} catch {
  $ips = @()
}

Write-Host ""
Write-Host "  Rutina 3+1 -- servidor en marcha" -ForegroundColor Yellow
Write-Host "  En este PC:  http://localhost:$Puerto/"
if ($enRed -and $ips.Count -gt 0) {
  foreach ($ip in $ips) { Write-Host "  En el movil: http://$ip`:$Puerto/" -ForegroundColor Green }
  Write-Host "  (el movil tiene que estar en el mismo wifi)"
} else {
  Write-Host "  Solo localhost. Para verlo en el movil, cierra y vuelve a" -ForegroundColor DarkYellow
  Write-Host "  ejecutar este archivo como Administrador." -ForegroundColor DarkYellow
}
Write-Host "  Parar con Ctrl + C"
Write-Host ""

# abre el navegador por defecto en la app
try { Start-Process ("http://localhost:{0}/" -f $Puerto) } catch { }

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }
  $ruta = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($ruta -eq "/" -or $ruta -eq "") { $ruta = "/index.html" }
  elseif ($ruta.EndsWith("/")) { $ruta = $ruta + "index.html" }
  $archivo = Join-Path $Raiz ($ruta.TrimStart("/") -replace "/", "\")
  # carpeta sin barra final: sirve su index.html
  if (Test-Path $archivo -PathType Container) {
    $ruta = $ruta.TrimEnd("/") + "/index.html"
    $archivo = Join-Path $Raiz ($ruta.TrimStart("/") -replace "/", "\")
  }

  # no salir de la carpeta del proyecto
  $completo = [System.IO.Path]::GetFullPath($archivo)
  if (-not $completo.StartsWith([System.IO.Path]::GetFullPath($Raiz))) {
    $ctx.Response.StatusCode = 403; $ctx.Response.Close(); continue
  }

  if (Test-Path $completo -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($completo).ToLower()
    $tipo = $mime[$ext]
    if (-not $tipo) { $tipo = "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($completo)
    $ctx.Response.ContentType = $tipo
    $ctx.Response.Headers.Add("Cache-Control", "no-store")
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Host ("  200  " + $ruta) -ForegroundColor DarkGray
  } else {
    $ctx.Response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes("404: " + $ruta)
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    Write-Host ("  404  " + $ruta) -ForegroundColor Red
  }
  $ctx.Response.Close()
}
