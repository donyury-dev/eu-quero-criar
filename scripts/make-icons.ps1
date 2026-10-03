$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $navy = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)
  $amber = [System.Drawing.Color]::FromArgb(255, 245, 158, 11)
  $white = [System.Drawing.Color]::White
  $bNavy = New-Object System.Drawing.SolidBrush($navy)
  $bAmber = New-Object System.Drawing.SolidBrush($amber)
  $bWhite = New-Object System.Drawing.SolidBrush($white)

  # rounded background
  $g.Clear([System.Drawing.Color]::Transparent)
  $radius = [int]($size * 0.22)
  $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = $radius
  $bgPath.AddArc(0, 0, $r, $r, 180, 90)
  $bgPath.AddArc($size - $r, 0, $r, $r, 270, 90)
  $bgPath.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
  $bgPath.AddArc(0, $size - $r, $r, $r, 90, 90)
  $bgPath.CloseFigure()
  $g.FillPath($bNavy, $bgPath)

  $s = $size / 512.0

  # calendar sheet (white rounded rect with amber header)
  $calX = 110 * $s; $calY = 130 * $s; $calW = 292 * $s; $calH = 268 * $s
  $calPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $cr = 28 * $s
  $calPath.AddArc($calX, $calY, $cr, $cr, 180, 90)
  $calPath.AddArc($calX + $calW - $cr, $calY, $cr, $cr, 270, 90)
  $calPath.AddArc($calX + $calW - $cr, $calY + $calH - $cr, $cr, $cr, 0, 90)
  $calPath.AddArc($calX, $calY + $calH - $cr, $cr, $cr, 90, 90)
  $calPath.CloseFigure()
  $g.FillPath($bWhite, $calPath)
  # amber header band
  $clip = $g.Clip
  $g.SetClip($calPath)
  $headRect = New-Object System.Drawing.Rectangle([int]$calX, [int]$calY, [int]$calW, [int](64 * $s))
  $g.FillRectangle($bAmber, $headRect)
  $g.Clip = $clip
  # binder rings
  $penNavy = New-Object System.Drawing.Pen($bNavy, [single](14 * $s))
  $penNavy.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $penNavy.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($penNavy, ($calX + 80 * $s), ($calY - 16 * $s), ($calX + 80 * $s), ($calY + 34 * $s))
  $g.DrawLine($penNavy, ($calX + $calW - 80 * $s), ($calY - 16 * $s), ($calX + $calW - 80 * $s), ($calY + 34 * $s))

  # scissors: two crossed blades + amber handle circles
  $cx = $calX + $calW / 2 + 10 * $s
  $cy = $calY + 78 * $s
  $bladeLen = 130 * $s
  $penWhite = New-Object System.Drawing.Pen($bNavy, [single](18 * $s))
  $penWhite.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $penWhite.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  # left blade
  $g.DrawLine($penWhite, ($cx - 55 * $s), ($cy + $bladeLen), ($cx + 45 * $s), $cy)
  # right blade
  $g.DrawLine($penWhite, ($cx + 55 * $s), ($cy + $bladeLen), ($cx - 45 * $s), $cy)
  # handles
  $hw = 34 * $s
  $penAmber = New-Object System.Drawing.Pen($bAmber, [single](16 * $s))
  $g.DrawEllipse($penAmber, ($cx - 55 * $s - $hw), ($cy + $bladeLen - 8 * $s), $hw, $hw)
  $g.DrawEllipse($penAmber, ($cx + 55 * $s), ($cy + $bladeLen - 8 * $s), $hw, $hw)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "saved $path"
}

New-Item -ItemType Directory -Force -Path "public\icons" | Out-Null
New-Icon 512 "public\icons\icon-512.png"
New-Icon 192 "public\icons\icon-192.png"
