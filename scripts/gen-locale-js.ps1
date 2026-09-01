$base = Join-Path $PSScriptRoot '..\locales'
foreach ($lang in @('ru', 'en')) {
  $jsonPath = Join-Path $base ($lang + '.json')
  $jsPath = Join-Path $base ($lang + '.js')
  $json = Get-Content $jsonPath -Raw -Encoding UTF8
  $header = "/* generated from $lang.json */`r`nwindow.I18N_LOCALES = window.I18N_LOCALES || {};`r`n"
  $body = "window.I18N_LOCALES['$lang'] = $json`r`n"
  Set-Content -Path $jsPath -Value ($header + $body) -Encoding UTF8 -NoNewline
  Write-Host "Wrote $jsPath"
}
